const { db } = require('../config/firebase');

// Colecciones que la app necesita para funcionar
const COLECCIONES_APP = ['mvpp-salas', 'mvpp-resultados-partida'];

/**
 * GET /api/db/status
 * Comprueba si Firestore está conectado y si las colecciones existen o son accesibles.
 * En Firestore las colecciones no se "crean" manualmente: aparecen al escribir el primer documento.
 * Este endpoint verifica que podemos leer (y por tanto que la colección "existe" o se puede usar).
 */
const getDbStatus = async (req, res) => {
    try {
        const resultado = {
            firestore: { conectado: false, error: null },
            colecciones: {}
        };

        for (const nombre of COLECCIONES_APP) {
            resultado.colecciones[nombre] = { accesible: false, documentos: null, error: null };
        }

        try {
            // Probar acceso a cada colección (una lectura mínima)
            for (const nombre of COLECCIONES_APP) {
                try {
                    const snapshot = await db.collection(nombre).limit(1).get();
                    resultado.colecciones[nombre].accesible = true;
                    // Contar todos los documentos (puede ser lento si hay muchos; opcional)
                    const fullSnapshot = await db.collection(nombre).get();
                    resultado.colecciones[nombre].documentos = fullSnapshot.size;
                } catch (err) {
                    resultado.colecciones[nombre].error = err.message || String(err);
                }
            }

            const algunaAccesible = Object.values(resultado.colecciones).some(c => c.accesible);
            resultado.firestore.conectado = algunaAccesible;
            if (!algunaAccesible) {
                const primerError = Object.values(resultado.colecciones).find(c => c.error);
                resultado.firestore.error = primerError?.error || 'No se pudo acceder a ninguna colección';
            }
        } catch (error) {
            resultado.firestore.error = error.message || String(error);
        }

        res.json(resultado);
    } catch (error) {
        console.error('❌ Error en dbController.getDbStatus:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

const clearRooms = async (req, res) => {
    try {
        const roomService = require('../services/roomService');
        const result = await roomService.clearRooms();
        res.json(result);
    } catch (error) {
        console.error('❌ Error en dbController.clearRooms:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getDbStatus,
    clearRooms
};
