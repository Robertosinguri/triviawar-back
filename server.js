require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const socketManager = require('./src/sockets/socketManager');

const DEFAULT_PORT = parseInt(process.env.PORT) || 3000;
const MAX_PORT_ATTEMPTS = 10;

/**
 * Verifica si un puerto está disponible
 * @param {number} port - Puerto a verificar
 * @returns {Promise<boolean>} true si el puerto está disponible
 */
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = http.createServer()
      .once('error', (err) => {
        // Si el error es EADDRINUSE, el puerto NO está disponible
        resolve(err.code !== 'EADDRINUSE');
      })
      .once('listening', () => {
        tester.close(() => resolve(true));
      })
      .listen(port);
  });
}

/**
 * Encuentra un puerto disponible comenzando desde startPort
 * @param {number} startPort - Puerto inicial para buscar
 * @param {number} maxAttempts - Intentos máximos
 * @returns {Promise<number>} Puerto disponible
 */
async function findAvailablePort(startPort, maxAttempts = MAX_PORT_ATTEMPTS) {
  for (let i = 0; i < maxAttempts; i++) {
    const currentPort = startPort + i;
    const available = await isPortAvailable(currentPort);
    
    if (available) {
      return currentPort;
    }
    
    console.warn(`⚠️  Puerto ${currentPort} en uso. Probando siguiente puerto...`);
  }
  
  throw new Error(`No se pudo encontrar un puerto disponible después de ${maxAttempts} intentos.`);
}

// Crear servidor HTTP a partir de Express app
const server = http.createServer(app);

// Inicializar Socket.io
socketManager.init(server);

/**
 * Inicia el servidor en el puerto especificado
 * @param {number} port - Puerto donde iniciar el servidor
 */
async function startApplication(port) {
  try {
    server.listen(port, () => {
      console.log(`
  🚀 TRIVIA WAR Backend corriendo!
  ---------------------------------
  📡 Port: ${port}
  🔧 Env:  ${process.env.NODE_ENV || 'development'}
  ---------------------------------
  `);
      console.log(`✅ Servidor iniciado exitosamente en puerto ${port}`);
    });
    
    // Manejar cierre graceful
    process.on('SIGTERM', () => {
      console.log('🛑 Recibida señal SIGTERM. Cerrando servidor...');
      server.close(() => {
        console.log('✅ Servidor cerrado exitosamente.');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('🛑 Recibida señal SIGINT (Ctrl+C). Cerrando servidor...');
      server.close(() => {
        console.log('✅ Servidor cerrado exitosamente.');
        process.exit(0);
      });
    });
    
    // Manejar errores del servidor
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Error: Puerto ${port} en uso.`);
        console.log('💡 Soluciones posibles:');
        console.log('   1. Esperar a que el proceso actual termine');
        console.log('   2. Ejecutar: netstat -ano | findstr :3000');
        console.log('   3. Ejecutar: taskkill /PID <PID> /F');
        console.log('   4. Cambiar la variable de entorno PORT');
      } else {
        console.error('❌ Error del servidor:', err.message);
      }
    });
    
  } catch (err) {
    console.error('❌ Error al iniciar la aplicación:', err.message);
    process.exit(1);
  }
}

// Iniciar la aplicación
(async () => {
  try {
    const availablePort = await findAvailablePort(DEFAULT_PORT);
    await startApplication(availablePort);
  } catch (err) {
    console.error('❌ Error crítico:', err.message);
    process.exit(1);
  }
})();
