const express = require('express');
const router = express.Router();

const mensajeController = require('../controllers/mensajeController');

// Enviar mensaje en un match
router.post('/mensaje', mensajeController.enviarMensaje);

module.exports = router;
