const express = require('express');
const router = express.Router();

const mensajeController = require('../controllers/mensajeController');

// Enviar mensaje en un match
router.post('/mensaje', mensajeController.enviarMensaje);
router.get('/', mensajeController.obtenerMensajes);

module.exports = router;
