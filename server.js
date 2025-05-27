const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg'); // Cambiamos mysql2 por pg
require('dotenv').config(); // Asegúrate de tener esto al inicio de tu archivo
const bcrypt = require('bcrypt');
const app = express();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configurar almacenamiento para fotos
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// Crear carpeta si no existe
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// Servir archivos estáticos
app.use('/uploads', express.static('uploads'));


// Configuración de PostgreSQL (usa variables de entorno en producción)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Necesario para Render PostgreSQL
  }
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
  const query = `
          SELECT 
            id, 
            nombre, 
            email, 
            COALESCE(descripcion, '') AS descripcion, 
            COALESCE(preferencia_genero, '') AS preferencia_genero 
          FROM usuarios 
          WHERE username = $1
        `;
  
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
      id: user.id,
      nombreCompleto: user.nombre,
      email: user.email,
      descripcion: user.descripcion,
      preferencia_genero: user.preferencia_genero
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
                email: user.email,
                descripcion: user.descripcion,
                preferencia_genero: user.preferencia_genero
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
app.put('/user/:username/perfil_completo', async (req, res) => {
  const { username } = req.params;
  const { descripcion, preferencia_genero } = req.body;

  if (!descripcion || !preferencia_genero) {
    return res.status(400).json({ status: 'error', message: 'Faltan campos requeridos' });
  }

  try {
    const result = await pool.query(
      `UPDATE usuarios 
       SET descripcion = $1, preferencia_genero = $2 
       WHERE username = $3 
       RETURNING id, nombre, username, email, descripcion, preferencia_genero`,
      [descripcion, preferencia_genero, username]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' });
    }

    return res.json({ status: 'success', message: 'Perfil completado', user: result.rows[0] });

  } catch (err) {
    console.error('Error al completar perfil:', err);
    return res.status(500).json({ status: 'error', message: 'Error en el servidor' });
  }
});
app.post('/foto', async (req, res) => {
  const { usuario_id, url } = req.body;

  if (!usuario_id || !url) {
    return res.status(400).json({ status: 'error', message: 'Faltan campos requeridos' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO fotos (usuario_id, url) 
       VALUES ($1, $2) 
       RETURNING id, url`,
      [usuario_id, url]
    );

    res.json({ status: 'success', message: 'Foto guardada', foto: result.rows[0] });
  } catch (err) {
    console.error('Error al subir foto:', err);
    res.status(500).json({ status: 'error', message: 'Error en el servidor' });
  }
});
app.get('/candidatos', async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ status: 'error', message: 'Falta userId en la consulta' });
  }

  try {
    const candidatos = await pool.query(`
      SELECT u.id, u.nombre, u.username, u.descripcion
      FROM usuarios u
      WHERE u.id != $1
        AND u.id NOT IN (
          SELECT receptor_id FROM likes WHERE emisor_id = $1
        )
      LIMIT 20
    `, [userId]);

    res.json({ status: 'success', candidatos: candidatos.rows });
  } catch (err) {
    console.error('Error en /candidatos:', err);
    res.status(500).json({ status: 'error', message: 'Error en el servidor' });
  }
});

app.post('/like', async (req, res) => {
  const { emisor_id, receptor_id, reaccion } = req.body;

  if (!emisor_id || !receptor_id || reaccion === undefined) {
    return res.status(400).json({ status: 'error', message: 'Faltan datos' });
  }

  try {
    // Guardar el like/dislike
    await pool.query(`
      INSERT INTO likes (emisor_id, receptor_id, reaccion)
      VALUES ($1, $2, $3)
      ON CONFLICT (emisor_id, receptor_id) DO UPDATE SET reaccion = EXCLUDED.reaccion
    `, [emisor_id, receptor_id, reaccion]);

    // Si fue like, verificar si el otro ya dio like
    if (reaccion) {
      const matchCheck = await pool.query(`
        SELECT * FROM likes
        WHERE emisor_id = $2 AND receptor_id = $1 AND reaccion = TRUE
      `, [emisor_id, receptor_id]);

      if (matchCheck.rows.length > 0) {
        // Crear match si no existe aún
        const existing = await pool.query(`
          SELECT * FROM matches
          WHERE (usuario1_id = $1 AND usuario2_id = $2) OR (usuario1_id = $2 AND usuario2_id = $1)
        `, [emisor_id, receptor_id]);

        if (existing.rows.length === 0) {
          await pool.query(`
            INSERT INTO matches (usuario1_id, usuario2_id)
            VALUES ($1, $2)
          `, [emisor_id, receptor_id]);
        }

        return res.json({ status: 'success', match: true });
      }
    }

    res.json({ status: 'success', match: false });
  } catch (err) {
    console.error('Error en /like:', err);
    res.status(500).json({ status: 'error', message: 'Error en el servidor' });
  }
});
app.get('/matches', async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ status: 'error', message: 'Falta userId' });
  }

  try {
    const matches = await pool.query(`
      SELECT 
        m.id AS match_id,
        u.id AS usuario_id,
        u.nombre,
        u.username,
        u.descripcion
      FROM matches m
      JOIN usuarios u ON (u.id = CASE 
        WHEN m.usuario1_id = $1 THEN m.usuario2_id 
        ELSE m.usuario1_id END)
      WHERE m.usuario1_id = $1 OR m.usuario2_id = $1
    `, [userId]);

    res.json({ status: 'success', matches: matches.rows });
  } catch (err) {
    console.error('Error en /matches:', err);
    res.status(500).json({ status: 'error', message: 'Error en el servidor' });
  }
});

app.post('/mensaje', async (req, res) => {
  const { match_id, emisor_id, mensaje } = req.body;

  if (!match_id || !emisor_id || !mensaje) {
    return res.status(400).json({ status: 'error', message: 'Faltan campos' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO mensajes (match_id, emisor_id, mensaje)
      VALUES ($1, $2, $3)
      RETURNING id, mensaje, fecha
    `, [match_id, emisor_id, mensaje]);

    res.json({ status: 'success', message: 'Mensaje enviado', data: result.rows[0] });
  } catch (err) {
    console.error('Error en /mensaje:', err);
    res.status(500).json({ status: 'error', message: 'Error en el servidor' });
  }
});

app.put('/user/:id/perfil_completo', async (req, res) => {
  const userId = req.params.id;
  const { descripcion, preferencia_genero, fotos } = req.body;

  if (!descripcion || !preferencia_genero || !fotos || !Array.isArray(fotos) || fotos.length < 3) {
    return res.status(400).json({ status: 'error', message: 'Faltan datos o fotos' });
  }

  try {
    // Actualizar usuario
    await pool.query(`
      UPDATE usuarios
      SET descripcion = $1, preferencia_genero = $2
      WHERE id = $3
    `, [descripcion, preferencia_genero, userId]);

    // Eliminar fotos anteriores
    await pool.query(`DELETE FROM fotos WHERE usuario_id = $1`, [userId]);

    // Insertar nuevas fotos
    for (const url of fotos) {
      await pool.query(`
        INSERT INTO fotos (usuario_id, url)
        VALUES ($1, $2)
      `, [userId, url]);
    }

    res.json({ status: 'success', message: 'Perfil completado con fotos' });

  } catch (err) {
    console.error('Error en PUT /user/:id/perfil_completo:', err);
    res.status(500).json({ status: 'error', message: 'Error en el servidor' });
  }
});


app.post('/upload_fotos', upload.fields([
  { name: 'foto1', maxCount: 1 },
  { name: 'foto2', maxCount: 1 },
  { name: 'foto3', maxCount: 1 }
]), async (req, res) => {
  try {
    const { userId, descripcion, preferencia_genero } = req.body;

    if (!userId || !descripcion || !preferencia_genero || !req.files) {
      return res.status(400).json({ status: 'error', message: 'Faltan campos o archivos' });
    }

    // Actualizar usuario
    await pool.query(`
      UPDATE usuarios 
      SET descripcion = $1, preferencia_genero = $2 
      WHERE id = $3
    `, [descripcion, preferencia_genero, userId]);

    // Guardar rutas de imágenes
    const fotos = ['foto1', 'foto2', 'foto3'];
    for (const campo of fotos) {
      const archivo = req.files[campo]?.[0];
      if (archivo) {
        const url = `/uploads/${archivo.filename}`;
        await pool.query(`
          INSERT INTO fotos (usuario_id, url)
          VALUES ($1, $2)
        `, [userId, url]);
      }
    }

    res.json({ status: 'success', message: 'Perfil y fotos guardados correctamente' });
  } catch (err) {
    console.error('Error en /upload_fotos:', err);
    res.status(500).json({ status: 'error', message: 'Error en el servidor' });
  }
});

// Puerto de escucha
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}`);
});