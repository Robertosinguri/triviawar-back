const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const apiRoutes = require('./routes/apiRoutes');

const app = express();

// Middlewares Globales
// Configurar helmet para permitir recursos cross-origin (necesario para audio)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
})); // Seguridad headers
app.use(cors());   // Permitir peticiones de otros dominios
app.use(express.json()); // Parsear body JSON
app.use(morgan('dev'));  // Logs de peticiones HTTP

// Servir archivos estáticos (favicon, avatares, manifest, sw.js, audio)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Servir avatares y audio bajo /api para que API Gateway los rutee
app.use('/dev/api/avatares', express.static(path.join(__dirname, '..', 'public', 'avatares')));
app.use('/api/avatares', express.static(path.join(__dirname, '..', 'public', 'avatares')));
app.use('/dev/api/audio', express.static(path.join(__dirname, '..', 'public', 'audio')));
app.use('/api/audio', express.static(path.join(__dirname, '..', 'public', 'audio')));


// Rutas base
app.get('/', (req, res) => {
    res.json({
        message: 'TRIVIA WAR API - Online',
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK', uptime: process.uptime() });
});

// Rutas API
// Compatibilidad con frontend antigua que llama a /dev/api
app.use('/dev/api', apiRoutes);
app.use('/api', apiRoutes);

// Manejo de errores global
app.use((err, req, res, next) => {
    console.error('❌ Error no controlado:', err);
    res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

module.exports = app;
