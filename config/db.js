const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Necesario para Render PostgreSQL
  }
});

// Opcional: verificación inicial de conexión
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error al conectar a PostgreSQL:', err);
  } else {
    console.log('✅ Conectado a PostgreSQL');
    release();
  }
});

module.exports = pool;
