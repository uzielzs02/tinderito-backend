const pool = require('../config/db');
const bcrypt = require('bcrypt');

// POST /register
exports.register = async (req, res) => {
  const { nombre, email, username, password, genero } = req.body;

  if (!nombre || !email || !username || !password || !genero) {
    return res.status(400).json({ status: 'error', message: 'Faltan campos requeridos' });
  }

  const checkQuery = 'SELECT * FROM usuarios WHERE username = $1 OR email = $2';

  try {
    const result = await pool.query(checkQuery, [username, email]);
    if (result.rows.length > 0) {
      const conflict = result.rows[0];
      if (conflict.username === username) {
        return res.json({ status: 'error', message: 'El nombre de usuario ya está en uso' });
      }
      if (conflict.email === email) {
        return res.json({ status: 'error', message: 'El correo electrónico ya está registrado' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const insertQuery = `
      INSERT INTO usuarios (nombre, email, username, password, genero) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING id, nombre, username, email, genero`;

    const insertResult = await pool.query(insertQuery, [nombre, email, username, hashedPassword, genero]);
    res.json({ status: 'success', message: 'Registro exitoso', user: insertResult.rows[0] });

  } catch (err) {
    console.error('Error en registro:', err);
    res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
  }
};

// POST /login
exports.login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM usuarios WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.json({ status: 'error', message: 'Usuario no encontrado' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.json({ status: 'error', message: 'Contraseña incorrecta' });
    }

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

  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ status: 'error', message: 'Error en el servidor' });
  }
};

// POST /deleteUser
exports.deleteUser = async (req, res) => {
  const { username } = req.body;

  try {
    const result = await pool.query('DELETE FROM usuarios WHERE username = $1 RETURNING *', [username]);
    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' });
    }
    res.json({ status: 'success', message: 'Usuario eliminado correctamente' });
  } catch (err) {
    console.error('Error al eliminar usuario:', err);
    res.status(500).json({ status: 'error', message: 'Error al eliminar el usuario' });
  }
};

// PUT /user/:username
exports.updateUser = async (req, res) => {
  const targetUsername = req.params.username;
  const { nombre, email, username, currentPassword, newPassword } = req.body;

  if (!nombre || !email || !username || !currentPassword) {
    return res.status(400).json({ status: 'error', message: 'Faltan campos requeridos' });
  }

  try {
    const userResult = await pool.query('SELECT * FROM usuarios WHERE username = $1', [targetUsername]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' });
    }

    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ status: 'error', message: 'Contraseña actual incorrecta' });
    }

    if (username !== targetUsername || email !== user.email) {
      const conflictResult = await pool.query(
        'SELECT id FROM usuarios WHERE (username = $1 OR email = $2) AND id != $3',
        [username, email, user.id]
      );

      if (conflictResult.rows.length > 0) {
        return res.status(409).json({ status: 'error', message: 'Username o email ya en uso' });
      }
    }

    let hashedPassword = user.password;
    if (newPassword) {
      hashedPassword = await bcrypt.hash(newPassword, 10);
    }

    await pool.query(`
      UPDATE usuarios 
      SET nombre = $1, email = $2, username = $3, password = $4 
      WHERE id = $5`, [nombre, email, username, hashedPassword, user.id]);

    res.json({ status: 'success', message: 'Perfil actualizado correctamente' });

  } catch (err) {
    console.error('Error al actualizar perfil:', err);
    res.status(500).json({ status: 'error', message: 'Error en el servidor' });
  }
};

// PUT /user/:username/perfil_completo
exports.completeProfile = async (req, res) => {
  const { username } = req.params;
  const { descripcion, preferencia_genero } = req.body;

  if (!descripcion || !preferencia_genero) {
    return res.status(400).json({ status: 'error', message: 'Faltan campos requeridos' });
  }

  try {
    const result = await pool.query(`
      UPDATE usuarios 
      SET descripcion = $1, preferencia_genero = $2 
      WHERE username = $3 
      RETURNING id, nombre, username, email, descripcion, preferencia_genero`,
      [descripcion, preferencia_genero, username]);

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' });
    }

    res.json({ status: 'success', message: 'Perfil completado', user: result.rows[0] });
  } catch (err) {
    console.error('Error al completar perfil:', err);
    res.status(500).json({ status: 'error', message: 'Error en el servidor' });
  }
};
