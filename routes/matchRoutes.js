const express = require('express');
const router = express.Router();

const matchController = require('../controllers/matchController');

// Obtener candidatos compatibles
router.get('/candidatos', matchController.getCandidatos);

// Dar like o dislike
router.post('/like', matchController.like);

// Obtener matches del usuario
router.get('/matches', matchController.getMatches);

module.exports = router;
