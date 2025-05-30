const pool = require('../config/db');

// POST /mensaje
exports.enviarMensaje = async (req, res) => {
  const { match_id, emisor_id, mensaje } = req.body;

  if (!match_id || !emisor_id || !mensaje) {
    return res.status(400).json({ status: 'error', message: 'Faltan campos' });
  }

  try {
    // Verificar que el usuario pertenezca al match
    const matchCheck = await pool.query(
      `SELECT * FROM matches 
       WHERE id = $1 AND ($2 = usuario1_id OR $2 = usuario2_id)`,
      [match_id, emisor_id]
    );

    if (matchCheck.rows.length === 0) {
      return res.status(403).json({ status: 'error', message: 'No autorizado para este chat' });
    }

    // Insertar mensaje
    const result = await pool.query(`
      INSERT INTO mensajes (match_id, emisor_id, mensaje)
      VALUES ($1, $2, $3)
      RETURNING id, mensaje, fecha
    `, [match_id, emisor_id, mensaje]);

    res.json({
      status: 'success',
      message: 'Mensaje enviado',
      data: result.rows[0]
    });

  } catch (err) {
    console.error('Error en /mensaje:', err);
    res.status(500).json({ status: 'error', message: 'Error en el servidor' });
  }
};
