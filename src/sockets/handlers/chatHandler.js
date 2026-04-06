const MAX_HISTORY = 50;
let globalHistory = [];
const connectedUsers = new Map(); // username -> socketId
const userPrivateGroups = new Map(); // username -> Set de usuarios en su grupo privado

function sendUserList(io) {
    const users = Array.from(connectedUsers.keys());
    io.emit('chat:users_list', users);
}

// Agregar usuario al grupo privado de otro usuario
function addToPrivateGroup(fromUser, toUser) {
    // Agregar 'toUser' al grupo de 'fromUser'
    if (!userPrivateGroups.has(fromUser)) {
        userPrivateGroups.set(fromUser, new Set());
    }
    userPrivateGroups.get(fromUser).add(toUser);
    
    // Agregar 'fromUser' al grupo de 'toUser' (BIDIRECCIONAL)
    if (!userPrivateGroups.has(toUser)) {
        userPrivateGroups.set(toUser, new Set());
    }
    userPrivateGroups.get(toUser).add(fromUser);
    
    console.log(`👥 [Grupos] ${fromUser} y ${toUser} ahora están en grupo mutuo`);
}

// Obtener miembros del grupo privado de un usuario
function getPrivateGroupMembers(username) {
    if (!userPrivateGroups.has(username)) {
        return [];
    }
    return Array.from(userPrivateGroups.get(username));
}

module.exports = (io, socket) => {
    // Unirse al chat
    socket.on('chat:join', (data) => {
        const { username, roomId } = data;
        socket.username = username;
        connectedUsers.set(username, socket.id);
        
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
            globalHistory.push(joinMsg);
            if (globalHistory.length > MAX_HISTORY) {
                globalHistory.shift();
            }
            io.emit('chat:message', joinMsg);
            // Enviar historial al nuevo usuario
            socket.emit('chat:history', globalHistory);
        } else {
            io.to(`chat_room_${roomId}`).emit('chat:message', joinMsg);
        }
        
        // Enviar lista actualizada de usuarios
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

    // Mensaje PRIVADO (1-a-1 o 1-a-muchos) con grupos bidireccionales
    socket.on('chat:private_message', (data) => {
        const { text, targetUsername, fromUsername } = data;
        
        // Separar múltiples destinatarios (si vienen separados por comas)
        const targetUsernames = targetUsername.split(',').map(u => u.trim());
        
        console.log(`📤 [Backend] Mensaje privado de ${fromUsername} a ${targetUsernames.length} usuarios:`, targetUsernames);

        // Para cada destinatario, establecer relación bidireccional
        targetUsernames.forEach(singleTarget => {
            // Establecer relación de grupo bidireccional
            addToPrivateGroup(fromUsername, singleTarget);
            
            const targetSocketId = connectedUsers.get(singleTarget);

            const pmObj = {
                id: 'pm-' + Date.now() + Math.random().toString(36).substr(2, 5),
                text,
                username: fromUsername,
                target: targetUsername, // Mantener la lista completa para referencia
                targetUsername: singleTarget, // Destinatario individual
                timestamp: new Date(),
                isPrivate: true,
                // Información adicional para el frontend
                groupAction: 'add_mutual', // Indica que se debe agregar mutuamente
                mutualUsers: [fromUsername, singleTarget] // Usuarios que ahora están en grupo mutuo
            };

            if (targetSocketId) {
                // Enviar al destinatario
                io.to(targetSocketId).emit('chat:private_message', pmObj);
                console.log(`   → Enviado a ${singleTarget} (grupo bidireccional establecido)`);
            } else {
                console.log(`   ⚠️ Usuario ${singleTarget} no encontrado`);
            }
        });

        // También enviar al remitente para que lo vea en su historial
        const senderPmObj = {
            id: 'pm-sender-' + Date.now() + Math.random().toString(36).substr(2, 5),
            text,
            username: fromUsername,
            target: targetUsername,
            timestamp: new Date(),
            isPrivate: true,
            groupAction: 'add_mutual',
            mutualUsers: [fromUsername, ...targetUsernames]
        };
        socket.emit('chat:private_message', senderPmObj);
        
        // Enviar actualización de grupo al remitente
        const groupUpdateMsg = {
            id: 'group-update-' + Date.now(),
            type: 'group_updated',
            username: fromUsername,
            members: getPrivateGroupMembers(fromUsername),
            timestamp: new Date()
        };
        socket.emit('chat:group_update', groupUpdateMsg);
    });

    // Obtener miembros del grupo privado
    socket.on('chat:get_private_group', (data) => {
        const { username } = data;
        const members = getPrivateGroupMembers(username);
        
        const groupInfo = {
            id: 'group-info-' + Date.now(),
            type: 'group_info',
            username,
            members,
            timestamp: new Date()
        };
        
        socket.emit('chat:group_info', groupInfo);
    });

    // Unirse a sala de chat específica
    socket.on('chat:join_room', (data) => {
        const { roomId } = data;
        socket.join(`chat_room_${roomId}`);
        console.log(`Usuario ${socket.username} se unió a chat_room_${roomId}`);
    });

    // Salir de sala de chat específica
    socket.on('chat:leave_room', (data) => {
        const { roomId } = data;
        socket.leave(`chat_room_${roomId}`);
        console.log(`Usuario ${socket.username} salió de chat_room_${roomId}`);
    });

    // Manejar desconexión específica para chat
    socket.on('disconnect', () => {
        if (socket.username) {
            connectedUsers.delete(socket.username);
            // Opcional: limpiar grupos del usuario desconectado
            // userPrivateGroups.delete(socket.username);
            sendUserList(io);
        }
    });
};