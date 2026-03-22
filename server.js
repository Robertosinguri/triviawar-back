require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const socketManager = require('./src/sockets/socketManager');

const PORT = process.env.PORT || 3000;

// Crear servidor HTTP a partir de Express app
const server = http.createServer(app);

// Inicializar Socket.io
socketManager.init(server);

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`
  🚀 TRIVIA WAR Backend corriendo!
  ---------------------------------
  📡 Port: ${PORT}
  🔧 Env:  ${process.env.NODE_ENV || 'development'}
  ---------------------------------
  `);
});
