const firestoreService = require('../services/firestoreService');

const COLLECTION = 'mvpp-salas';

const createRoom = async (roomData) => {
    return await firestoreService.crear(COLLECTION, roomData);
};

const getRoom = async (roomCode) => {
    return await firestoreService.obtenerPorId(COLLECTION, { roomCode });
};

const updateRoom = async (roomCode, updates) => {
    return await firestoreService.actualizar(COLLECTION, { roomCode }, updates);
};

const deleteRoom = async (roomCode) => {
    return await firestoreService.borrar(COLLECTION, { roomCode });
};

const getAllRooms = async () => {
    return await firestoreService.obtenerTodos(COLLECTION);
};

module.exports = {
    createRoom,
    getRoom,
    updateRoom,
    deleteRoom,
    getAllRooms
};
