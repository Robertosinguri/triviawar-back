const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');
const authController = require('../controllers/authController');
const statsController = require('../controllers/statsController');
const roomController = require('../controllers/roomController');
const dbController = require('../controllers/dbController');

// Comprobar estado de Firestore y colecciones (para verificar que existen / son accesibles)
router.get('/db/status', dbController.getDbStatus);

// Rutas de Autenticación
router.post('/auth/login', authController.login);
router.post('/auth/signup', authController.signUp);
router.post('/auth/update-profile', authController.updateProfile);

// Rutas de Estadísticas
router.get('/stats/personal', statsController.getMyStats);
router.get('/stats/ranking', statsController.getGlobalRanking);

// Rutas de Juegos
router.post('/games/generate-questions', gameController.generateQuestions);
router.post('/games/submit-result', gameController.submitResult);

// Rutas de Salas (el frontend hace GET /rooms/:code para polling de resultados)
router.get('/rooms/:code', roomController.getRoom);

module.exports = router;
