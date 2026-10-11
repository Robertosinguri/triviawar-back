const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');
const authController = require('../controllers/authController');
const statsController = require('../controllers/statsController');
const roomController = require('../controllers/roomController');
const dbController = require('../controllers/dbController');
const audioController = require('../controllers/audioController');
const encuestaController = require('../controllers/encuestaController');

// Comprobar estado de Firestore y colecciones (para verificar que existen / son accesibles)
router.get('/db/status', dbController.getDbStatus);
router.get('/db/clear-rooms', dbController.clearRooms);

// Rutas de Autenticación
router.post('/auth/login', authController.login);
router.post('/auth/signup', authController.signUp);
router.post('/auth/update-profile', authController.updateProfile);
router.post('/auth/resend-verification', authController.resendVerification);
router.post('/auth/forgot-password', authController.forgotPassword);
router.post('/auth/google-login', authController.googleLogin);



// Rutas de Estadísticas
router.get('/stats/personal', statsController.getMyStats);
router.get('/stats/ranking', statsController.getGlobalRanking);

// Rutas de Juegos
router.post('/games/generate-questions', gameController.generateQuestions);
router.post('/games/submit-result', gameController.submitResult);

// Rutas de Salas (el frontend hace GET /rooms/:code para polling de resultados)
router.get('/rooms', roomController.getActiveRooms);
router.get('/rooms/:code', roomController.getRoom);

// Rutas de Audio
router.get('/audio/list', audioController.listAudioFiles);
router.get('/audio/:filename', audioController.getAudio);

// Rutas de la Encuesta de bienvenida
// submit: guarda la respuesta (idempotente, un documento por dispositivo)
// vincular: enriquece la respuesta anónima con la cuenta real tras el login
router.post('/encuesta/submit', encuestaController.submit);
router.post('/encuesta/vincular', encuestaController.vincular);
// Panel de resultados: protegido con la clave de acceso (header x-clave-acceso)
router.get('/encuesta/estadisticas', encuestaController.estadisticas);

module.exports = router;
