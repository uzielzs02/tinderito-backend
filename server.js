const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg'); // Cambiamos mysql2 por pg
const bcrypt = require('bcrypt');
const app = express();

// Configuración de PostgreSQL (usa variables de entorno en producción)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:1234@localhost:5432/tinderito',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Verificación de conexión
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error al conectar a PostgreSQL:', err);
  } else {
    console.log('Conectado a PostgreSQL');
    release();
  }
});

app.use(bodyParser.json());

// Middleware de logs
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log(`Body:`, req.body);
  next();
});

// -------- ENDPOINTS --------

// GET /prueba
app.get('/prueba', (req, res) => {
  const username = req.query.username;
  const query = 'SELECT nombre, email FROM usuarios WHERE username = $1';
  
  pool.query(query, [username], (err, results) => {
    if (err) {
      console.error('Error al consultar el usuario:', err);
      return res.status(500).json({ status: 'error', message: 'Error en el servidor' });
    }

    if (results.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' });
    }

    const user = results.rows[0];
    res.json({
      nombreCompleto: user.nombre,
      email: user.email
    });
  });
});

// POST /login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const query = 'SELECT * FROM usuarios WHERE username = $1';

  pool.query(query, [username], (err, results) => {
    if (err) return res.status(500).json({ status: 'error', message: 'Error en el servidor' });

    if (results.rows.length === 0) {
      return res.json({ status: 'error', message: 'Usuario no encontrado' });
    }

    const user = results.rows[0];
    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (isMatch) {
        res.json({
          status: 'success',
          message: 'Login exitoso',
          user: {
            id: user.id,
            nombre: user.nombre,
            username: user.username,
            email: user.email
          }
        });
      } else {
        res.json({ status: 'error', message: 'Contraseña incorrecta' });
      }
    });
  });
});

// POST /register
app.post('/register', async (req, res) => {
  const { nombre, email, username, password } = req.body;
  const checkQuery = 'SELECT * FROM usuarios WHERE username = $1 OR email = $2';

  pool.query(checkQuery, [username, email], async (err, results) => {
    if (err) return res.status(500).json({ status: 'error', message: 'Error en el servidor' });

    if (results.rows.length > 0) {
      const conflict = results.rows[0];
      if (conflict.username === username) {
        return res.json({ status: 'error', message: 'El nombre de usuario ya está en uso' });
      }
      if (conflict.email === email) {
        return res.json({ status: 'error', message: 'El correo electrónico ya está registrado' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const insertQuery = `
      INSERT INTO usuarios (nombre, email, username, password) 
      VALUES ($1, $2, $3, $4) 
      RETURNING id, nombre, username, email
    `;

    pool.query(insertQuery, [nombre, email, username, hashedPassword], (err, result) => {
      if (err) return res.status(500).json({ status: 'error', message: 'Error al registrar el usuario' });

      const newUser = result.rows[0];
      res.json({
        status: 'success',
        message: 'Registro exitoso',
        user: newUser
      });
    });
  });
});

// POST /deleteUser
app.post('/deleteUser', (req, res) => {
  const { username } = req.body;
  const deleteQuery = 'DELETE FROM usuarios WHERE username = $1 RETURNING *';

  pool.query(deleteQuery, [username], (err, results) => {
    if (err) {
      console.error('Error al eliminar usuario:', err);
      return res.status(500).json({ status: 'error', message: 'Error al eliminar el usuario' });
    }

    if (results.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' });
    }

    return res.status(200).json({ status: 'success', message: 'Usuario eliminado correctamente' });
  });
});

// PUT /user/:username
app.put('/user/:username', async (req, res) => {
  const targetUsername = req.params.username;
  const { nombre, email, username, currentPassword, newPassword } = req.body;

  if (!nombre || !email || !username || !currentPassword) {
    return res.status(400).json({ status: 'error', message: 'Faltan campos requeridos' });
  }

  try {
    // Función auxiliar para actualizar
    const updateUser = async (user) => {
      let hashedPassword = user.password;
      if (newPassword) {
        hashedPassword = await bcrypt.hash(newPassword, 10);
      }

      const updateQuery = `
        UPDATE usuarios 
        SET nombre = $1, email = $2, username = $3, password = $4 
        WHERE id = $5
        RETURNING id, nombre, email, username
      `;

      const updateResult = await pool.query(updateQuery, [
        nombre, email, username, hashedPassword, user.id
      ]);

      if (updateResult.rows.length > 0) {
        return res.json({
          status: 'success',
          message: 'Perfil actualizado correctamente'
        });
      } else {
        return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' });
      }
    };

    // Verificar usuario actual
    const userResult = await pool.query(
      'SELECT * FROM usuarios WHERE username = $1', 
      [targetUsername]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' });
    }

    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ status: 'error', message: 'Contraseña actual incorrecta' });
    }

    // Verificar conflictos si cambió username o email
    if (username !== targetUsername || email !== user.email) {
      const conflictResult = await pool.query(
        'SELECT id FROM usuarios WHERE (username = $1 OR email = $2) AND id != $3',
        [username, email, user.id]
      );

      if (conflictResult.rows.length > 0) {
        const conflict = conflictResult.rows[0];
        if (conflict.username === username) {
          return res.status(409).json({ status: 'error', message: 'Nombre de usuario en uso' });
        }
        if (conflict.email === email) {
          return res.status(409).json({ status: 'error', message: 'Email ya registrado' });
        }
      }
    }

    // Actualizar usuario
    await updateUser(user);
  } catch (err) {
    console.error("Error en PUT /user:", err);
    res.status(500).json({ status: 'error', message: 'Error en el servidor' });
  }
});

// Puerto de escucha
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}`);
});