const { db } = require('../config/firebase');

// Almacén en memoria para cuando no hay credenciales (Fallback Mode)
const memoryStore = {
    'mvpp-salas': {},
    'mvpp-resultados-partida': {},
    'mvpp-users': {},
    'mvpp-stats': {}
};

let offlineMode = false;

const handleFirebaseError = (error, operation, coleccion, id, data = null) => {
    // Detectar si es error de credenciales
    if (error.message.includes('Could not load the default credentials') ||
        error.message.includes('Unable to detect a Project Id')) {

        if (!offlineMode) {
            console.warn('⚠️ FALLO CONEXIÓN FIRESTORE: Activando MODO MEMORIA TEMPORAL (Los datos se perderán al reiniciar)');
            offlineMode = true;
        }

        // Operación en memoria
        if (!memoryStore[coleccion]) memoryStore[coleccion] = {};

        if (operation === 'crear' || operation === 'actualizar') {
            const docId = typeof id === 'object' ? Object.values(id)[0] : id;
            // Merge básico para actualizar, overwrite para crear si no existe
            const prevData = memoryStore[coleccion][docId] || {};
            // Usamos 'data' explícitamente porque 'arguments' no existe en arrow functions
            const paramData = data || {};

            memoryStore[coleccion][docId] = { ...prevData, ...paramData };
            console.log(`💾 [MEMORIA] ${operation} en ${coleccion}/${docId}`);
            return { id: docId, ...memoryStore[coleccion][docId] };
        }

        if (operation === 'obtener') {
            const docId = typeof id === 'object' ? Object.values(id)[0] : id;
            const dataStored = memoryStore[coleccion][docId];
            console.log(`💾 [MEMORIA] Leído ${coleccion}/${docId}:`, dataStored ? 'OK' : 'NULL');
            return dataStored ? { id: docId, ...dataStored } : null;
        }

        if (operation === 'borrar') {
            const docId = typeof id === 'object' ? Object.values(id)[0] : id;
            delete memoryStore[coleccion][docId];
            return true;
        }

        return null;
    }
    throw error;
};

const crear = async (coleccion, datos) => {
    const id = datos.id || datos.roomCode || datos.userId || datos.email;
    try {
        if (offlineMode) throw new Error('Could not load the default credentials'); // Forzar fallback directo si ya sabemos

        if (id) {
            await db.collection(coleccion).doc(id).set(datos);
            return { id, ...datos };
        } else {
            const docRef = await db.collection(coleccion).add(datos);
            return { id: docRef.id, ...datos };
        }
    } catch (error) {
        // Pasamos datos como 5to argumento para el handler
        return handleFirebaseError(error, 'crear', coleccion, id, datos);
    }
};

const obtenerPorId = async (coleccion, id) => {
    try {
        if (offlineMode) throw new Error('Could not load the default credentials');

        const docId = typeof id === 'object' ? Object.values(id)[0] : id;
        const doc = await db.collection(coleccion).doc(docId).get();
        if (!doc.exists) return null;
        return { id: doc.id, ...doc.data() };
    } catch (error) {
        return handleFirebaseError(error, 'obtener', coleccion, id);
    }
};

const actualizar = async (coleccion, id, datosActualizados) => {
    try {
        if (offlineMode) throw new Error('Could not load the default credentials');

        const docId = typeof id === 'object' ? Object.values(id)[0] : id;
        await db.collection(coleccion).doc(docId).update(datosActualizados);
        return { id: docId, ...datosActualizados };
    } catch (error) {
        return handleFirebaseError(error, 'actualizar', coleccion, id, datosActualizados);
    }
};

const borrar = async (coleccion, id) => {
    try {
        if (offlineMode) throw new Error('Could not load the default credentials');

        const docId = typeof id === 'object' ? Object.values(id)[0] : id;
        await db.collection(coleccion).doc(docId).delete();
        return true;
    } catch (error) {
        return handleFirebaseError(error, 'borrar', coleccion, id);
    }
};

const escanearTodos = async (coleccion) => {
    try {
        if (offlineMode) throw new Error('Could not load the default credentials');

        const snapshot = await db.collection(coleccion).get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        if (error.message.includes('Could not load') || error.message.includes('Project Id')) {
            if (!memoryStore[coleccion]) return [];
            return Object.keys(memoryStore[coleccion]).map(key => ({
                id: key,
                ...memoryStore[coleccion][key]
            }));
        }
        throw error;
    }
};

// ... resto de funciones igual ...
const consultar = async (coleccion, campo, operador, valor) => {
    // Implementación básica para memoria si es necesario, por ahora devuelve todo
    // TODO: Mejorar si se requiere filtrado real en memoria
    return escanearTodos(coleccion);
};

const obtenerTodos = async (coleccion) => {
    return await escanearTodos(coleccion);
};

module.exports = {
    crear,
    obtenerPorId,
    actualizar,
    borrar,
    escanearTodos,
    obtenerTodos,
    consultar,
    scan: escanearTodos
};
