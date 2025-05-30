const pool = require('../config/db');

// GET /prueba
exports.getUsuarioPorUsername = async (req, res) => {
  const username = req.query.username;

  try {
    const result = await pool.query(`
      SELECT 
        id, nombre, email, 
        COALESCE(descripcion, '') AS descripcion, 
        COALESCE(preferencia_genero, '') AS preferencia_genero 
      FROM usuarios 
      WHERE username = $1
    `, [username]);

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' });
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      nombreCompleto: user.nombre,
      email: user.email,
      descripcion: user.descripcion,
      preferencia_genero: user.preferencia_genero
    });

  } catch (err) {
    console.error('Error en /prueba:', err);
    res.status(500).json({ status: 'error', message: 'Error en el servidor' });
  }
};

// GET /user/:id
exports.getUsuarioPorId = async (req, res) => {
  const userId = req.params.id;

  try {
    const userResult = await pool.query(`
      SELECT 
        id, nombre, username, email, genero, 
        preferencia_genero, descripcion 
      FROM usuarios 
      WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' });
    }

    const fotosResult = await pool.query(`
      SELECT url FROM fotos WHERE usuario_id = $1 ORDER BY id ASC
    `, [userId]);

    const user = userResult.rows[0];
    user.fotos = fotosResult.rows.map(row => row.url);

    res.json({ status: 'success', user });

  } catch (err) {
    console.error('Error en /user/:id:', err);
    res.status(500).json({ status: 'error', message: 'Error en el servidor' });
  }
};

// PUT /user/:id/perfil_completo
exports.actualizarPerfilConFotos = async (req, res) => {
  const userId = req.params.id;
  const { descripcion, preferencia_genero, fotos } = req.body;

  if (!descripcion || !preferencia_genero || !Array.isArray(fotos) || fotos.length < 3) {
    return res.status(400).json({ status: 'error', message: 'Faltan datos o fotos' });
  }

  try {
    await pool.query(`
      UPDATE usuarios
      SET descripcion = $1, preferencia_genero = $2
      WHERE id = $3
    `, [descripcion, preferencia_genero, userId]);

    await pool.query(`DELETE FROM fotos WHERE usuario_id = $1`, [userId]);

    for (const url of fotos) {
      await pool.query(`
        INSERT INTO fotos (usuario_id, url)
        VALUES ($1, $2)
      `, [userId, url]);
    }

    res.json({ status: 'success', message: 'Perfil completado con fotos' });

  } catch (err) {
    console.error('Error al actualizar perfil con fotos:', err);
    res.status(500).json({ status: 'error', message: 'Error en el servidor' });
  }
};

// POST /upload_fotos
exports.uploadFotos = async (req, res) => {
  try {
    const { userId, descripcion, preferencia_genero } = req.body;
    if (!userId || !descripcion || !preferencia_genero || !req.files) {
      return res.status(400).json({ status: 'error', message: 'Faltan campos o archivos' });
    }

    await pool.query(`
      UPDATE usuarios
      SET descripcion = $1, preferencia_genero = $2
      WHERE id = $3
    `, [descripcion, preferencia_genero, userId]);

    const campos = ['foto1', 'foto2', 'foto3'];
    for (const campo of campos) {
      const archivo = req.files[campo]?.[0];
      if (archivo) {
        const url = `/uploads/${archivo.filename}`;
        await pool.query(`INSERT INTO fotos (usuario_id, url) VALUES ($1, $2)`, [userId, url]);
      }
    }

    res.json({ status: 'success', message: 'Perfil y fotos guardados correctamente' });

  } catch (err) {
    console.error('Error en /upload_fotos:', err);
    res.status(500).json({ status: 'error', message: 'Error en el servidor' });
  }
};

// POST /foto (opcional)
exports.guardarFotoIndividual = async (req, res) => {
  const { usuario_id, url } = req.body;

  if (!usuario_id || !url) {
    return res.status(400).json({ status: 'error', message: 'Faltan campos requeridos' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO fotos (usuario_id, url)
      VALUES ($1, $2)
      RETURNING id, url
    `, [usuario_id, url]);

    res.json({ status: 'success', message: 'Foto guardada', foto: result.rows[0] });

  } catch (err) {
    console.error('Error al guardar foto individual:', err);
    res.status(500).json({ status: 'error', message: 'Error en el servidor' });
  }
};
