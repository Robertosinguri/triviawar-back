const connectedUsers = new Map(); // username -> socketId

function sendUserList(io) {
    const users = Array.from(connectedUsers.keys());
    io.emit('chat:users_list', users);
}

module.exports = (io, socket) => {
    // Unirse al chat
    socket.on('chat:join', (data) => {
        const { username, roomId } = data;
        socket.username = username;
        connectedUsers.set(username, socket.id);
        
        // --- LIMPIEZA DE SEGURIDAD AL UNIRSE ---
        // (No hay grupos privados que limpiar)

        const joinMsg = {
            id: 'system-' + Date.now(),
            text: `${username} se ha unido al chat${roomId ? ' de la sala' : ''}`,
            username: 'Sistema',
            timestamp: new Date(),
            isSystem: true,
            roomId: roomId || null
        };

        if (!roomId) {
            // Chat GLOBAL
            io.emit('chat:message', joinMsg);
        } else {
            io.to(`chat_room_${roomId}`).emit('chat:message', joinMsg);
        }
        
        sendUserList(io);
    });

    // Enviar mensaje
    socket.on('chat:send_message', (data) => {
        const { text, roomId, username } = data;
        
        const messageObj = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            text,
            username,
            timestamp: new Date(),
            roomId: roomId || null,
            isSystem: false
        };

        if (!roomId) {
            io.emit('chat:message', messageObj);
        } else {
            io.to(`chat_room_${roomId}`).emit('chat:message', messageObj);
        }
    });

    // Salas
    socket.on('chat:join_room', (data) => {
        socket.join(`chat_room_${data.roomId}`);
    });

    socket.on('chat:leave_room', (data) => {
        socket.leave(`chat_room_${data.roomId}`);
    });

    socket.on('disconnect', () => {
        if (socket.username) {
            console.log(`🔌 [Backend] Usuario desconectado: ${socket.username}`);
            
            const username = socket.username;
            
            // Quitar de la lista de usuarios conectados
            connectedUsers.delete(username);
            sendUserList(io);
        }
    });
};