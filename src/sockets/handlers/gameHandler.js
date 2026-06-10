const roomService = require('../../services/roomService');
const gameService = require('../../services/gameService');
const statsService = require('../../services/statsService');
const { admin } = require('../../config/firebase');

module.exports = (io, socket) => {

    async function enriquecerConFotos(players) {
        if (!players || players.length === 0) return players;
        try {
            const uids = players.filter(p => p.id && p.id.length > 5).map(p => p.id);
            if (uids.length === 0) return players;

            const { db } = require('../../config/firebase');
            const statsSnap = await db.collection('mvpp-estadisticas')
                .where('__name__', 'in', uids.slice(0, 30))
                .get();
            const statsPicture = {};
            statsSnap.docs.forEach(d => {
                const p = d.data().picture;
                if (p && p !== '01.webp' && !p.startsWith('http')) {
                    statsPicture[d.id] = p;
                }
            });

            const result = await admin.auth().getUsers(uids.map(uid => ({ uid })));
            const authPicture = {};
            result.users.forEach(u => { authPicture[u.uid] = u.photoURL || null; });

            return players.map(p => {
                const custom = statsPicture[p.id];
                const google = authPicture[p.id];
                return { ...p, picture: custom || google || null };
            });
        } catch (e) {
            console.warn('⚠️ No se pudieron obtener fotos:', e.message);
            return players;
        }
    }

    // CREAR SALA
    socket.on('create_room', async (data) => {
        try {
            const hostName = (data.host && data.host.nombre) || data.nombre || 'Anónimo';
            console.log(`🔌 Socket ${socket.id} (${hostName}) creando sala`);
            const newRoom = await roomService.createRoom(data);
            
            socket.roomCode = newRoom.id;
            socket.userId = (data.host && data.host.id) || data.id;

            socket.join(newRoom.id);
            socket.emit('room_created', newRoom);
            console.log(`✅ Sala creada: ${newRoom.id}`);
        } catch (error) {
            console.error('❌ Error creando sala:', error);
            socket.emit('error', { message: error.message });
        }
    });

    // UNIRSE A SALA
    socket.on('join_room', async (data) => {
        try {
            const { roomCode, player } = data;
            console.log(`🔌 Socket ${socket.id} (${player.nombre}) intentando unirse a sala ${roomCode}`);

            const updatedRoom = await roomService.joinRoom(roomCode, player);

            socket.roomCode = roomCode;
            socket.userId = player.id;

            socket.join(roomCode);
            io.to(roomCode).emit('room_updated', updatedRoom);
            console.log(`✅ Jugador ${player.nombre} unido a ${roomCode}`);
        } catch (error) {
            console.error('❌ Error en join_room:', error.message);
            socket.emit('error', { message: error.message });
        }
    });

    // DESCONEXIÓN (Cerrar pestaña, pérdida de red, etc.)
    socket.on('disconnect', async () => {
        if (socket.roomCode && socket.userId) {
            console.log(`🔌 Cliente ${socket.userId} desconectado. Limpiando sala ${socket.roomCode}...`);
            try {
                const updatedRoom = await roomService.leaveRoom(socket.roomCode, socket.userId);
                if (updatedRoom) {
                    io.to(socket.roomCode).emit('room_updated', updatedRoom);
                    await autoFinalizarSiTodosTerminaron(io, socket.roomCode, updatedRoom);
                } else {
                    console.log(`🗑️ Sala ${socket.roomCode} eliminada automáticamente (quedó vacía)`);
                }
            } catch (error) {
                console.error('❌ Error limpiando sala en desconexión:', error.message);
            }
        }
    });

    // SALIR DE SALA (Manual)
    socket.on('leave_room', async (data) => {
        try {
            const { roomCode, userId } = data;
            const updatedRoom = await roomService.leaveRoom(roomCode, userId);

            socket.roomCode = null;
            socket.userId = null;

            socket.leave(roomCode);

            if (updatedRoom) {
                io.to(roomCode).emit('room_updated', updatedRoom);
                await autoFinalizarSiTodosTerminaron(io, roomCode, updatedRoom);
            } else {
                console.log(`🗑️ Sala ${roomCode} eliminada (vacía)`);
            }
        } catch (error) {
            console.error('❌ Error en leave_room:', error.message);
        }
    });

    // ACTUALIZAR CONFIGURACIÓN JUGADOR
    socket.on('update_config', async (data) => {
        try {
            const { roomCode, userId, config } = data;
            const updatedRoom = await roomService.updatePlayerConfig(roomCode, userId, config);
            io.to(roomCode).emit('room_updated', updatedRoom);

            const jugadoresListos = updatedRoom.jugadores.filter(p => p.configurado).length;
            if (jugadoresListos === updatedRoom.maxJugadores) {
                console.log(`🚀 Todos los jugadores están listos. Iniciando juego automáticamente en sala ${roomCode}`);
                io.to(roomCode).emit('game_loading', { message: 'Generando preguntas con IA...' });
                const gameData = await gameService.startGame(roomCode);
                io.to(roomCode).emit('game_started', gameData);
            }
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    // INICIAR JUEGO
    socket.on('start_game', async (data) => {
        try {
            const { roomCode } = data;
            console.log(`🚀 Solicitud de inicio de juego para ${roomCode}`);

            io.to(roomCode).emit('game_loading', { message: 'Generando preguntas con IA...' });

            const gameData = await gameService.startGame(roomCode);

            io.to(roomCode).emit('game_started', gameData);

        } catch (error) {
            console.error('❌ Error start_game:', error);
            io.to(data.roomCode).emit('error', { message: 'Error iniciando juego: ' + error.message });
        }
    });

    // RECEPCIÓN DE RESULTADOS (PUNTAJE PARCIAL O FINAL)
    socket.on('save_game_result', async (data) => {
        try {
            const { roomCode, result } = data;
            console.log(`💾 [SOCKET] save_game_result -> Room: ${roomCode} | User: ${result?.userId}`);

            const dataToSave = { ...result, roomCode };
            await statsService.guardarResultado(result.userId, dataToSave);

            const roomResults = await statsService.obtenerResultadosPorSala(roomCode);

            let ranking = roomResults.map(r => ({
                userId: r.userId,
                username: r.username || 'Jugador',
                nombre: r.username || 'Jugador',
                puntaje: r.puntaje || 0,
                tiempoTotal: r.tiempoTotal || 0,
                respuestasCorrectas: r.respuestasCorrectas || 0,
                totalPreguntas: r.totalPreguntas || 0,
                porcentaje: r.totalPreguntas > 0 ? Math.round((r.respuestasCorrectas / r.totalPreguntas) * 100) : 0,
                tematica: r.tematica || 'General'
            }));

            ranking.sort((a, b) => {
                if (b.puntaje !== a.puntaje) return b.puntaje - a.puntaje;
                return a.tiempoTotal - b.tiempoTotal;
            });

            ranking = ranking.map((p, index) => ({ ...p, posicion: index + 1 }));

            const room = await roomService.getRoom(roomCode);
            const roomPlayers = room && room.jugadores ? room.jugadores.map(j => {
                const finished = roomResults.some(r => r.userId === j.id);
                return {
                    id: j.id,
                    nombre: j.nombre,
                    esHost: j.esHost || false,
                    terminado: finished
                };
            }) : [];

            const enrichedPlayers = await enriquecerConFotos(roomPlayers);
            io.to(roomCode).emit('ranking_update', { ranking, roomPlayers: enrichedPlayers });
            console.log(`📡 Ranking emitido a sala ${roomCode} (${ranking.length} resultados, ${enrichedPlayers.length} jugadores)`);

        } catch (error) {
            console.error('❌ Error en save_game_result:', error);
            socket.emit('error', { message: error.message });
        }
    });

    // NOTIFICAR PROGRESO (sin guardar, solo broadcast del estado de jugadores)
    socket.on('notify_progress', async (data) => {
        try {
            const { roomCode } = data;
            const room = await roomService.getRoom(roomCode);
            const roomResults = await statsService.obtenerResultadosPorSala(roomCode);

            const roomPlayers = room && room.jugadores ? room.jugadores.map(j => {
                const finished = roomResults.some(r => r.userId === j.id);
                return {
                    id: j.id,
                    nombre: j.nombre,
                    esHost: j.esHost || false,
                    terminado: finished
                };
            }) : [];

            let ranking = roomResults.map(r => ({
                userId: r.userId,
                username: r.username || 'Jugador',
                nombre: r.username || 'Jugador',
                puntaje: r.puntaje || 0,
                tiempoTotal: r.tiempoTotal || 0,
                respuestasCorrectas: r.respuestasCorrectas || 0,
                totalPreguntas: r.totalPreguntas || 0,
                porcentaje: r.totalPreguntas > 0 ? Math.round((r.respuestasCorrectas / r.totalPreguntas) * 100) : 0,
                tematica: r.tematica || 'General'
            }));

            ranking.sort((a, b) => {
                if (b.puntaje !== a.puntaje) return b.puntaje - a.puntaje;
                return a.tiempoTotal - b.tiempoTotal;
            });
            ranking = ranking.map((p, index) => ({ ...p, posicion: index + 1 }));

            const enrichedPlayers = await enriquecerConFotos(roomPlayers);
            io.to(roomCode).emit('ranking_update', { ranking, roomPlayers: enrichedPlayers });
            console.log(`📡 notify_progress emitido a sala ${roomCode} (${enrichedPlayers.length} jugadores)`);
        } catch (error) {
            console.error('❌ Error en notify_progress:', error);
        }
    });

    // Auto-finalizar sala si todos los jugadores restantes ya terminaron
    async function autoFinalizarSiTodosTerminaron(io, roomCode, room) {
        if (!room || room.estado !== 'playing') return;

        try {
            const roomResults = await statsService.obtenerResultadosPorSala(roomCode);
            const jugadoresRestantes = room.jugadores.length;

            if (jugadoresRestantes > 0 && roomResults.length >= jugadoresRestantes) {
                let ranking = roomResults.map(r => ({
                    userId: r.userId,
                    username: r.username || 'Jugador',
                    nombre: r.username || 'Jugador',
                    puntaje: r.puntaje || 0,
                    tiempoTotal: r.tiempoTotal || 0,
                    respuestasCorrectas: r.respuestasCorrectas || 0,
                    totalPreguntas: r.totalPreguntas || 0,
                    porcentaje: r.totalPreguntas > 0 ? Math.round((r.respuestasCorrectas / r.totalPreguntas) * 100) : 0,
                    tematica: r.tematica || 'General'
                }));

                ranking.sort((a, b) => {
                    if (b.puntaje !== a.puntaje) return b.puntaje - a.puntaje;
                    return a.tiempoTotal - b.tiempoTotal;
                });
                ranking = ranking.map((p, index) => ({ ...p, posicion: index + 1 }));

                await roomService.updateRoomStatus(roomCode, 'finalizada', {
                    ranking,
                    ganador: ranking[0]
                });

                io.to(roomCode).emit('room_updated', { ...room, estado: 'finalizada', resultadosFinales: { ranking, ganador: ranking[0] } });
                console.log(`✅ Sala ${roomCode} auto-finalizada tras abandono (${roomResults.length}/${jugadoresRestantes} terminados)`);
            }
        } catch (error) {
            console.error('❌ Error en autoFinalizarSiTodosTerminaron:', error);
        }
    }
};
