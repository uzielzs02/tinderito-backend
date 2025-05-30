const pool = require('../config/db');

// GET /candidatos
exports.getCandidatos = async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ status: 'error', message: 'Falta userId en la consulta' });
  }

  try {
    const userResult = await pool.query(
      `SELECT genero, preferencia_genero FROM usuarios WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' });
    }

    const { genero, preferencia_genero } = userResult.rows[0];

    const candidatos = await pool.query(`
      SELECT 
        u.id, 
        u.nombre, 
        u.username, 
        u.descripcion,
        f.url AS foto
      FROM usuarios u
      LEFT JOIN (
        SELECT DISTINCT ON (usuario_id) usuario_id, url
        FROM fotos
        ORDER BY usuario_id, id ASC
      ) f ON f.usuario_id = u.id
      WHERE u.id != $1
        AND ($2 = 'ambos' OR u.genero = $2)
        AND (u.preferencia_genero = 'ambos' OR u.preferencia_genero = $3)
        AND u.id NOT IN (
          SELECT receptor_id FROM likes WHERE emisor_id = $1
        )
      LIMIT 20
    `, [userId, preferencia_genero, genero]);

    res.json({ status: 'success', candidatos: candidatos.rows });

  } catch (err) {
    console.error('Error en /candidatos:', err);
    res.status(500).json({ status: 'error', message: 'Error en el servidor' });
  }
};

// POST /like
exports.like = async (req, res) => {
  const { emisor_id, receptor_id, reaccion } = req.body;

  if (!emisor_id || !receptor_id || reaccion === undefined) {
    return res.status(400).json({ status: 'error', message: 'Faltan datos' });
  }

  try {
    await pool.query(`
      INSERT INTO likes (emisor_id, receptor_id, reaccion)
      VALUES ($1, $2, $3)
      ON CONFLICT (emisor_id, receptor_id) DO UPDATE SET reaccion = EXCLUDED.reaccion
    `, [emisor_id, receptor_id, reaccion]);

    if (reaccion) {
      const matchCheck = await pool.query(`
        SELECT * FROM likes
        WHERE emisor_id = $2 AND receptor_id = $1 AND reaccion = TRUE
      `, [emisor_id, receptor_id]);

      if (matchCheck.rows.length > 0) {
        const existing = await pool.query(`
          SELECT * FROM matches
          WHERE (usuario1_id = $1 AND usuario2_id = $2)
             OR (usuario1_id = $2 AND usuario2_id = $1)
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
};

// GET /matches
exports.getMatches = async (req, res) => {
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
};
