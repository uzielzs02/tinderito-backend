const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const userController = require('../controllers/userController');

// Configurar multer para carga de fotos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// Obtener datos básicos del usuario por username
router.get('/prueba', userController.getUsuarioPorUsername);

// Obtener datos y fotos del usuario por ID
router.get('/user/:id', userController.getUsuarioPorId);

// ✅ ACTUALIZAR PERFIL CON FOTOS (PUT con multipart)
router.put('/user/:id/perfil_completo', upload.any(), userController.actualizarPerfilConFotos);

// Subir fotos (formato multipart)
router.post('/upload_fotos', upload.fields([
  { name: 'foto1', maxCount: 1 },
  { name: 'foto2', maxCount: 1 },
  { name: 'foto3', maxCount: 1 }
]), userController.uploadFotos);

// Guardar una sola foto (opcional)
router.post('/foto', userController.guardarFotoIndividual);

module.exports = router;
