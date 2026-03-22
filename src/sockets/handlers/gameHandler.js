const roomService = require('../../services/roomService');
const gameService = require('../../services/gameService');
const statsService = require('../../services/statsService');

module.exports = (io, socket) => {

    // CREAR SALA
    socket.on('create_room', async (data) => {
        try {
            const hostName = (data.host && data.host.nombre) || data.nombre || 'Anónimo';
            console.log(`🔌 Socket ${socket.id} (${hostName}) creando sala`);
            const newRoom = await roomService.createRoom(data); // data debe traer { host: {...}, nombre, maxJugadores }

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
        // data: { roomCode, player: { id, nombre, ... } }
        try {
            const { roomCode, player } = data;
            console.log(`🔌 Socket ${socket.id} (${player.nombre}) intentando unirse a sala ${roomCode}`);

            const updatedRoom = await roomService.joinRoom(roomCode, player);

            // Unir el socket al canal de Socket.io
            socket.join(roomCode);

            // Notificar a TODOS en la sala (incluido el que se unió para confirmar)
            io.to(roomCode).emit('room_updated', updatedRoom);

            console.log(`✅ Jugador ${player.nombre} unido a ${roomCode}`);
        } catch (error) {
            console.error('❌ Error en join_room:', error.message);
            socket.emit('error', { message: error.message });
        }
    });

    // SALIR DE SALA
    socket.on('leave_room', async (data) => {
        try {
            const { roomCode, userId } = data;
            const updatedRoom = await roomService.leaveRoom(roomCode, userId);

            socket.leave(roomCode);

            if (updatedRoom) {
                io.to(roomCode).emit('room_updated', updatedRoom);
            } else {
                // La sala se eliminó
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
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    // INICIAR JUEGO
    socket.on('start_game', async (data) => {
        try {
            const { roomCode } = data;
            console.log(`🚀 Solicitud de inicio de juego para ${roomCode}`);

            // Notificar que se está cargando (para mostrar spinners)
            io.to(roomCode).emit('game_loading', { message: 'Generando preguntas con IA...' });

            const gameData = await gameService.startGame(roomCode);

            // Enviar preguntas a todos y cambiar pantalla
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
            
            // 1. Guardar resultado (asegurando que roomCode persista)
            const dataToSave = { ...result, roomCode };
            await statsService.guardarResultado(result.userId, dataToSave);

            // 2. Obtener ranking actualizado de la sala (incluye a todos los que hayan terminado)
            const roomResults = await statsService.obtenerResultadosPorSala(roomCode);
            
            // 3. Calcular ranking unificado
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

            // Ordenar: Mayor puntaje gana. En empate, menor tiempo gana.
            ranking.sort((a, b) => {
                if (b.puntaje !== a.puntaje) return b.puntaje - a.puntaje;
                return a.tiempoTotal - b.tiempoTotal;
            });
            
            ranking = ranking.map((p, index) => ({ ...p, posicion: index + 1 }));

            // 4. Emitir a TODOS en la sala para que actualicen su tabla
            io.to(roomCode).emit('ranking_update', ranking);
            console.log(`📡 Ranking emitido a sala ${roomCode} (${ranking.length} resultados)`);

        } catch (error) {
            console.error('❌ Error en save_game_result:', error);
            socket.emit('error', { message: error.message });
        }
    });
};
