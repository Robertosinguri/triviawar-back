const socketIo = require('socket.io');

let io;

const init = (httpServer) => {
    io = socketIo(httpServer, {
        cors: {
            origin: "*", // En producción, restringir al dominio del frontend
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        console.log(`🔌 Nuevo cliente conectado: ${socket.id}`);

        // Importar handlers
        require('./handlers/gameHandler')(io, socket);
        require('./handlers/statsHandler')(io, socket);
        // require('./handlers/chatHandler')(io, socket);

        socket.on('disconnect', () => {
            console.log(`❌ Cliente desconectado: ${socket.id}`);
        });
    });

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error('Socket.io no ha sido inicializado!');
    }
    return io;
};

module.exports = {
    init,
    getIO
};
