const express = require('express');
const helmet = require('helmet');
const path = require('path');
const dotenv = require('dotenv');
const logger = require('./middlewares/logger');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const matchRoutes = require('./routes/matchRoutes');
const mensajeRoutes = require('./routes/mensajeRoutes');

dotenv.config(); // Cargar variables de entorno

const app = express();

// Seguridad básica
app.use(helmet());

// Parseo de JSON
app.use(express.json());

// Logger personalizado
app.use(logger);

// Carpeta para archivos estáticos (imágenes)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rutas principales
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/match', matchRoutes);
app.use('/api/mensajes', mensajeRoutes);

// Puerto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en el puerto ${PORT}`);
});
