const roomRepository = require('../repositories/roomRepository');

// Una sala en espera sin actividad durante este tiempo se considera abandonada.
const TTL_ESPERANDO_MS = 5 * 60 * 1000;

const createRoom = async (data) => {
    // data puede ser { id, nombre... } (legacy) o { host: {id...}, maxJugadores, nombre } (nuevo)
    const host = data.host || data;
    const maxJugadores = data.maxJugadores || 4;

    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const hostPlayer = {
        id: host.id,
        nombre: host.nombre,
        esHost: true,
        configurado: false,
        tematica: ''
    };

    const newRoom = {
        id: roomCode,
        roomCode,
        fechaCreacion: new Date().toISOString(),
        ultimaActividad: new Date().toISOString(),
        estado: 'esperando',
        nombre: data.nombre || `${host.nombre}'s Game`,
        jugadores: [hostPlayer],
        maxJugadores: maxJugadores
    };

    // Validación extra para evitar undefined
    if (!hostPlayer.id) throw new Error("Host ID is undefined");

    await roomRepository.createRoom(newRoom);
    return newRoom;
};

const joinRoom = async (roomCode, playerParams) => {
    const room = await roomRepository.getRoom(roomCode);
    console.log('🔍 [DEBUG] joinRoom fetch:', JSON.stringify(room, null, 2)); // DEBUG LOG
    if (!room) throw new Error('Sala no encontrada');
    if (room.estado !== 'esperando') {
        // Compatibilidad: las salas que quedaron en el estado inválido 'waiting'
        // (bug viejo cuando la IA fallaba) se recuperan al intentar entrar.
        if (room.estado === 'waiting') {
            console.warn(`♻️ Sala ${roomCode} estaba en estado inválido 'waiting'. Se recupera como 'esperando'.`);
            room.estado = 'esperando';
            await roomRepository.updateRoom(roomCode, { estado: 'esperando' });
        } else {
            console.error(`❌ Estado inválido: ${room.estado} (esperaba: esperando)`);
            throw new Error('La partida ya ha comenzado');
        }
    }
    const playerExists = room.jugadores.find(p => p.id === playerParams.id);
    if (playerExists) {
        // Si ya existe, actualizamos sus datos (reconexión simple)
        // Y permitimos entrar incluso si está "llena" (porque él ya ocupa un lugar)
        await roomRepository.updateRoom(roomCode, { ultimaActividad: new Date().toISOString() });
        return room;
    }

    if (room.jugadores.length >= (room.maxJugadores || 4)) throw new Error('Sala llena');

    const newPlayer = {
        id: playerParams.id,
        nombre: playerParams.nombre,
        esHost: false,
        configurado: false,
        tematica: ''
    };

    room.jugadores.push(newPlayer);

    // Actualizamos toda la lista de jugadores
    await roomRepository.updateRoom(roomCode, {
        jugadores: room.jugadores,
        ultimaActividad: new Date().toISOString()
    });

    return room;
};

const leaveRoom = async (roomCode, playerId) => {
    const room = await roomRepository.getRoom(roomCode);
    if (!room) return null;

    const playerIndex = room.jugadores.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return room;

    // Si es host, pasar el liderazgo
    if (room.jugadores[playerIndex].esHost && room.jugadores.length > 1) {
        // El siguiente jugador (o el anterior si era el ultimo)
        const nextHostIndex = playerIndex === 0 ? 1 : 0;
        room.jugadores[nextHostIndex].esHost = true;
    }

    room.jugadores.splice(playerIndex, 1);

    if (room.jugadores.length === 0) {
        await roomRepository.deleteRoom(roomCode);
        return null;
    } else {
        await roomRepository.updateRoom(roomCode, {
            jugadores: room.jugadores,
            ultimaActividad: new Date().toISOString()
        });
        return room;
    }
};

const updatePlayerConfig = async (roomCode, userId, config) => {
    const room = await roomRepository.getRoom(roomCode);
    if (!room) throw new Error('Sala no encontrada');

    const player = room.jugadores.find(p => p.id === userId);
    if (!player) throw new Error('Jugador no encontrado en sala');

    if (config.configurado && config.tematica) {
        const temaEnUso = room.jugadores.find(p => p.id !== userId && p.configurado && p.tematica.toLowerCase() === config.tematica.toLowerCase());
        if (temaEnUso) {
            throw new Error('El tema ya fue elegido');
        }
    }

    player.tematica = config.tematica || '';
    player.configurado = config.configurado;

    await roomRepository.updateRoom(roomCode, {
        jugadores: room.jugadores,
        ultimaActividad: new Date().toISOString()
    });
    return room;
};

// Marca la sala como activa (se usa en heartbeat y otras acciones)
const touchRoom = async (roomCode) => {
    const room = await roomRepository.getRoom(roomCode);
    if (!room) return null;
    await roomRepository.updateRoom(roomCode, { ultimaActividad: new Date().toISOString() });
    return room;
};

const getActiveRooms = async () => {
    const allRooms = await roomRepository.getAllRooms();
    console.log(`🔍 [DEBUG] getActiveRooms - Total en DB: ${allRooms.length}`);

    const ahora = Date.now();
    const filtered = [];

    for (const r of allRooms) {
        if (r.estado !== 'esperando') continue;

        // Limpieza de salas abandonadas: si nadie las toca en TTL_ESPERANDO_MS, se eliminan.
        const ultima = Date.parse(r.ultimaActividad || r.fechaCreacion || '');
        if (!Number.isNaN(ultima) && (ahora - ultima) > TTL_ESPERANDO_MS) {
            try {
                await roomRepository.deleteRoom(r.roomCode || r.id);
                console.log(`🧹 Sala inactiva eliminada: ${r.roomCode || r.id}`);
            } catch (e) {
                console.warn(`⚠️ No se pudo eliminar la sala inactiva ${r.roomCode || r.id}:`, e.message);
            }
            continue;
        }

        // Retornamos solo salas en espera que tengan cupo y NOMBRE
        const conCupo = (r.jugadores || []).length < (r.maxJugadores || 4);
        const conNombre = r.nombre && r.nombre.trim() !== '';
        if (conCupo && conNombre) filtered.push(r);
    }

    console.log(`🔍 [DEBUG] getActiveRooms - Filtradas (activas): ${filtered.length}`);
    return filtered;
};

const clearRooms = async () => {
    const allRooms = await roomRepository.getAllRooms();
    for (const room of allRooms) {
        await roomRepository.deleteRoom(room.id);
    }
    return { success: true, deletedCount: allRooms.length };
};

module.exports = {
    createRoom,
    joinRoom,
    leaveRoom,
    updatePlayerConfig,
    getActiveRooms,
    clearRooms,
    touchRoom,
    getRoom: roomRepository.getRoom,
    updateRoomStatus: async (roomCode, status, results = null) => {
        const updates = { estado: status };
        if (results) {
            updates.resultadosFinales = results;
        }
        return await roomRepository.updateRoom(roomCode, updates);
    }
};
