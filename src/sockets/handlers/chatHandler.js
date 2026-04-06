const globalHistory = [];
const MAX_HISTORY = 50;
const connectedUsers = new Map(); // Mapa de username -> socketId

module.exports = (io, socket) => {
    // Cuando un usuario se conecta, le enviamos el historial global
    socket.emit('chat:history', globalHistory);

    // Enviar lista de usuarios conectados a quien se acaba de conectar
    const sendUserList = () => {
        const users = Array.from(connectedUsers.keys());
        io.emit('chat:users_list', users);
    };

    // Unirse a una sala específica de chat (si aplica)
    socket.on('chat:join_room', (roomId) => {
        if (roomId) {
            socket.join(`chat_room_${roomId}`);
            console.log(`User ${socket.id} joined chat room: ${roomId}`);
        }
    });

    // Salir de una sala de chat
    socket.on('chat:leave_room', (roomId) => {
        if (roomId) {
            socket.leave(`chat_room_${roomId}`);
            console.log(`User ${socket.id} left chat room: ${roomId}`);
        }
    });

    // Notificar cuando un usuario se une al chat
    socket.on('chat:join', (data) => {
        const { username, roomId } = data;
        socket.username = username; // Guardamos para la desconexión
        
        // Registrar usuario en el mapa (un usuario puede tener múltiples conexiones, pero guardamos la última)
        connectedUsers.set(username, socket.id);
        sendUserList();
        
        const joinMsg = {
            id: 'sys-' + Date.now(),
            text: `${username} se ha unido al chat`,
            username: 'Sistema',
            timestamp: new Date(),
            roomId: roomId || null,
            isSystem: true
        };

        if (!roomId) {
            io.emit('chat:message', joinMsg);
        } else {
            io.to(`chat_room_${roomId}`).emit('chat:message', joinMsg);
        }
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
            // Mensaje GLOBAL
            globalHistory.push(messageObj);
            if (globalHistory.length > MAX_HISTORY) {
                globalHistory.shift();
            }
            io.emit('chat:message', messageObj);
        } else {
            // Mensaje de SALA
            io.to(`chat_room_${roomId}`).emit('chat:message', messageObj);
        }
    });

    // Mensaje PRIVADO (Sub-chat)
    socket.on('chat:private_message', (data) => {
        const { text, targetUsername, fromUsername } = data;
        const targetSocketId = connectedUsers.get(targetUsername);

        const pmObj = {
            id: 'pm-' + Date.now() + Math.random().toString(36).substr(2, 5),
            text,
            username: fromUsername,
            target: targetUsername,
            timestamp: new Date(),
            isPrivate: true
        };

        if (targetSocketId) {
            // Enviar al destinatario
            io.to(targetSocketId).emit('chat:private_message', pmObj);
            // También enviar al remitente para que lo vea en su historial (si no usa la misma conexión)
            socket.emit('chat:private_message', pmObj);
        }
    });

    // Manejar desconexión específica para chat
    socket.on('disconnect', () => {
        if (socket.username) {
            connectedUsers.delete(socket.username);
            sendUserList();
        }
    });
};
