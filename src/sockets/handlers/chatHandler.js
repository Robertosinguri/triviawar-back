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

// Eliminar relación de grupo privado (BIDIRECCIONAL)
function removeFromPrivateGroup(fromUser, toUser) {
    if (userPrivateGroups.has(fromUser)) {
        userPrivateGroups.get(fromUser).delete(toUser);
    }
    if (userPrivateGroups.has(toUser)) {
        userPrivateGroups.get(toUser).delete(fromUser);
    }
    console.log(`💔 [Grupos] ${fromUser} y ${toUser} se han desconectado mutuamente`);
}

// Obtener miembros del grupo privado de un usuario
function getPrivateGroupMembers(username) {
    if (!userPrivateGroups.has(username)) {
        return [];
    }
    return Array.from(userPrivateGroups.get(username));
}

module.exports = (io, socket) => {
    // Track si este socket ya ha recibido historial
    socket.hasReceivedHistory = false;
    
    // Unirse al chat
    socket.on('chat:join', (data) => {
        const { username, roomId } = data;
        socket.username = username;
        connectedUsers.set(username, socket.id);
        
        // --- LIMPIEZA DE SEGURIDAD AL UNIRSE ---
        if (userPrivateGroups.has(username)) {
            const myGroup = userPrivateGroups.get(username);
            myGroup.forEach(member => {
                if (!connectedUsers.has(member)) {
                    myGroup.delete(member);
                    if (userPrivateGroups.has(member)) {
                        userPrivateGroups.get(member).delete(username);
                    }
                }
            });
            if (myGroup.size === 0) userPrivateGroups.delete(username);
        }

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
            if (globalHistory.length > MAX_HISTORY) globalHistory.shift();
            io.emit('chat:message', joinMsg);
            
            if (!socket.hasReceivedHistory) {
                socket.emit('chat:history', globalHistory);
                socket.hasReceivedHistory = true;
            }
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
            globalHistory.push(messageObj);
            if (globalHistory.length > MAX_HISTORY) globalHistory.shift();
            io.emit('chat:message', messageObj);
        } else {
            io.to(`chat_room_${roomId}`).emit('chat:message', messageObj);
        }
    });

    // Mensaje PRIVADO
    socket.on('chat:private_message', (data) => {
        const { text, targetUsername, fromUsername } = data;
        const targetUsernames = targetUsername.split(',').map(u => u.trim());
        
        targetUsernames.forEach(singleTarget => {
            addToPrivateGroup(fromUsername, singleTarget);
            const targetSocketId = connectedUsers.get(singleTarget);

            const pmObj = {
                id: 'pm-' + Date.now() + Math.random().toString(36).substr(2, 5),
                text,
                username: fromUsername,
                target: targetUsername,
                targetUsername: singleTarget,
                timestamp: new Date(),
                isPrivate: true,
                groupAction: 'add_mutual',
                mutualUsers: [fromUsername, singleTarget]
            };

            if (targetSocketId) {
                io.to(targetSocketId).emit('chat:private_message', pmObj);
            }
        });

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
        
        socket.emit('chat:group_update', {
            id: 'group-update-' + Date.now(),
            type: 'group_updated',
            username: fromUsername,
            members: getPrivateGroupMembers(fromUsername),
            timestamp: new Date()
        });
    });

    // Obtener miembros del grupo privado
    socket.on('chat:get_private_group', (data) => {
        const { username } = data;
        socket.emit('chat:group_info', {
            id: 'group-info-' + Date.now(),
            type: 'group_info',
            username,
            members: getPrivateGroupMembers(username),
            timestamp: new Date()
        });
    });

    // Abandonar conversación privada (Bidireccional)
    socket.on('chat:leave_private', (data) => {
        const { targetUsername, fromUsername } = data;
        removeFromPrivateGroup(fromUsername, targetUsername);

        // Notificar a ambos usuarios
        const notify = (user, skipSocket = false) => {
            const updateMsg = {
                id: 'group-update-' + Date.now(),
                type: 'group_updated',
                username: user,
                members: getPrivateGroupMembers(user),
                timestamp: new Date()
            };
            const sid = connectedUsers.get(user);
            if (sid) io.to(sid).emit('chat:group_update', updateMsg);
        };

        notify(fromUsername);
        notify(targetUsername);
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
            console.log(`🔌 [Backend] Usuario desconectado: ${socket.username}. Limpiando grupos privados.`);
            
            const username = socket.username;
            const myMembers = getPrivateGroupMembers(username);

            // Notificar a todos los que estaban hablando conmigo que ya no estoy disponible
            myMembers.forEach(otherUser => {
                // Eliminarme de la lista del otro usuario
                if (userPrivateGroups.has(otherUser)) {
                    userPrivateGroups.get(otherUser).delete(username);
                    
                    // Notificarle que su lista cambió
                    const sid = connectedUsers.get(otherUser);
                    if (sid) {
                        io.to(sid).emit('chat:group_update', {
                            id: 'group-disconnect-' + Date.now(),
                            type: 'group_updated',
                            username: otherUser,
                            members: getPrivateGroupMembers(otherUser),
                            timestamp: new Date()
                        });
                    }
                }
            });

            // Limpiar mi propia lista
            userPrivateGroups.delete(username);
            
            // Quitar de la lista de usuarios conectados
            connectedUsers.delete(username);
            sendUserList(io);
        }
    });
};