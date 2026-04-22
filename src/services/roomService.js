const roomRepository = require('../repositories/roomRepository');

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
        console.error(`❌ Estado inválido: ${room.estado} (esperaba: esperando)`);
        throw new Error('La partida ya ha comenzado');
    }
    const playerExists = room.jugadores.find(p => p.id === playerParams.id);
    if (playerExists) {
        // Si ya existe, actualizamos sus datos (reconexión simple)
        // Y permitimos entrar incluso si está "llena" (porque él ya ocupa un lugar)
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
    await roomRepository.updateRoom(roomCode, { jugadores: room.jugadores });

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
        await roomRepository.updateRoom(roomCode, { jugadores: room.jugadores });
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

    await roomRepository.updateRoom(roomCode, { jugadores: room.jugadores });
    return room;
};

const getActiveRooms = async () => {
    const allRooms = await roomRepository.getAllRooms();
    console.log(`🔍 [DEBUG] getActiveRooms - Total en DB: ${allRooms.length}`);
    
    // Retornamos solo salas en espera que tengan cupo y NOMBRE
    const filtered = allRooms.filter(r => 
        r.estado === 'esperando' && 
        (r.jugadores || []).length < (r.maxJugadores || 4) &&
        r.nombre && r.nombre.trim() !== ''
    );

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
    getRoom: roomRepository.getRoom,
    updateRoomStatus: async (roomCode, status, results = null) => {
        const updates = { estado: status };
        if (results) {
            updates.resultadosFinales = results;
        }
        return await roomRepository.updateRoom(roomCode, updates);
    }
};
