const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');

// Registro
router.post('/register', authController.register);

// Login
router.post('/login', authController.login);

// Eliminar usuario
router.post('/deleteUser', authController.deleteUser);

// Editar perfil (nombre, email, username, password)
router.put('/user/:username', authController.updateUser);

// Completar perfil (preferencia y descripción)
router.put('/user/:username/perfil_completo', authController.completeProfile);

module.exports = router;
