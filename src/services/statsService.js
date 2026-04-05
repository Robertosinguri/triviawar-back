const firestoreService = require('./firestoreService');
const { db } = require('../config/firebase');
const admin = require('firebase-admin');

const COLLECTION_STATS = 'mvpp-estadisticas';
const COLLECTION_RESULTS = 'mvpp-resultados-partida';

const obtenerEstadisticasPersonales = async (userId, username) => {
    try {
        console.log(`📊 [STATS] Obteniendo estadísticas para: ${userId}`);

        let userResults = [];
        let posicionRanking = '-';

        // 1. Obtener posición en el ranking (consultando la colección agregada)
        try {
            const rankingSnapshot = await db.collection(COLLECTION_STATS)
                .orderBy('puntajeTotal', 'desc')
                .get();

            const index = rankingSnapshot.docs.findIndex(doc => doc.id === userId);
            if (index !== -1) {
                posicionRanking = index + 1;
            }
        } catch (rankError) {
            console.warn('⚠️ No se pudo calcular posición de ranking:', rankError.message);
        }

        // 2. Obtener resultados de partidas
        try {
            const snapshot = await db.collection(COLLECTION_RESULTS)
                .where('userId', '==', userId)
                .get();
            userResults = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (dbError) {
            if (dbError.message.includes('Could not load') || dbError.message.includes('Project Id')) {
                console.warn('⚠️ [STATS] Fallback a memoria');
                const allResults = await firestoreService.obtenerTodos(COLLECTION_RESULTS);
                userResults = allResults.filter(r => r.userId === userId);
            } else throw dbError;
        }

        console.log(`📈 [STATS] Partidas encontradas para ${userId}: ${userResults.length}`);

        if (userResults.length === 0) {
            return {
                partidasJugadas: 0,
                mejorPuntaje: 0,
                promedio: 0,
                puntajeTotal: 0,
                posicionRanking,
                temasRecientes: []
            };
        }

        const partidasJugadas = userResults.length;
        const puntajeTotal = userResults.reduce((sum, r) => sum + (r.puntaje || 0), 0);
        const promedio = parseFloat((puntajeTotal / partidasJugadas).toFixed(2));
        const mejorPuntaje = Math.max(...userResults.map(p => p.puntaje || 0));

        const temasRecientes = userResults
            .filter(p => p.fecha && p.tematica)
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
            .slice(0, 5)
            .map(p => p.tematica);

        return {
            partidasJugadas,
            mejorPuntaje,
            promedio,
            puntajeTotal,
            posicionRanking,
            temasRecientes
        };

    } catch (error) {
        console.error('❌ Error obteniendo estadísticas:', error);
        throw error;
    }
};

const obtenerResultadosPorSala = async (roomCode) => {
    try {
        console.log(`📊 [STATS] Buscando resultados para sala: '${roomCode}' (Tipo: ${typeof roomCode})`);
        let roomResults = [];

        try {
            // Query para obtener todos los resultados de la sala
            const snapshot = await db.collection(COLLECTION_RESULTS)
                .where('roomCode', '==', roomCode)
                .get();

            if (snapshot.empty) {
                console.log(`⚠️ [STATS] Firestore: 0 resultados encontrados para sala '${roomCode}'`);
            } else {
                console.log(`✅ [STATS] Firestore: ${snapshot.size} resultados encontrados.`);
                snapshot.docs.forEach(d => console.log(`   -> DocID: ${d.id} | User: ${d.data().userId} | Pts: ${d.data().puntaje}`));
            }

            roomResults = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (dbError) {
            // Fallback a memoria si falla Firestore
            if (dbError.message.includes('Could not load') || dbError.message.includes('Project Id')) {
                console.log(`⚠️ [STATS] Usando Fallback Memoria para sala '${roomCode}'`);
                const allResults = await firestoreService.obtenerTodos(COLLECTION_RESULTS);

                // DIAGNÓSTICO: Ver qué códigos de sala existen en memoria
                const salasEnMemoria = [...new Set(allResults.map(r => r.roomCode))];
                console.log(`🔍 [STATS] Salas disponibles en memoria:`, salasEnMemoria);

                roomResults = allResults.filter(r => r.roomCode == roomCode); // Usar == para flexibilidad string/number
                console.log(`✅ [STATS] Memoria: ${roomResults.length} resultados filtrados.`);
            } else throw dbError;
        }

        return roomResults;
    } catch (error) {
        console.error('❌ Error obteniendo resultados de sala:', error);
        return [];
    }
};

const guardarResultado = async (userId, resultado) => {
    // resultado: { username, tematica, dificultad, puntaje, respuestasCorrectas, totalPreguntas, tiempoTotal }
    try {
        // LOG DIAGNÓSTICO
        console.log(`💾 [STATS] Guardando resultado -> User: ${userId} | Room: ${resultado.roomCode} | Pts: ${resultado.puntaje}`);

        const statsData = {
            ...resultado, // Spread al inicio para evitar que nulos sobrescriban los defaults
            userId,
            username: resultado.username || 'Usuario',
            fecha: new Date().toISOString(),
        };

        // Usamos timestamp como ID único de la partida
        const partidaId = `${userId}-${Date.now()}`;

        // En Firestore: crear(collection, data, docId?)
        // Si firestoreService.crear soporta 3 args, bien. Si no, le pasamos el ID dentro de data o dejamos que genere uno.
        // Dado el firestoreService actual, parece que el ID es opcional o se pasa en el objeto.
        // Asumiremos que creamos un documento nuevo.

        await firestoreService.crear(COLLECTION_RESULTS, {
            ...statsData,
            id: partidaId // Por si acaso
        });

        // ⚡ OPTIMIZACIÓN: Actualizar tabla de estadísticas acumuladas (Agregación)
        try {
            const userStatsRef = db.collection(COLLECTION_STATS).doc(userId);
            await userStatsRef.set({
                userId,
                username: resultado.username || 'Usuario',
                // Incrementos atómicos
                puntajeTotal: admin.firestore.FieldValue.increment(resultado.puntaje || 0),
                partidasJugadas: admin.firestore.FieldValue.increment(1),
                ultimaPartida: new Date().toISOString()
            }, { merge: true });
        } catch (dbError) {
            if (dbError.message.includes('Could not load') || dbError.message.includes('Project Id')) {
                // Fallback manual para memoria
                const currentStats = await firestoreService.obtenerPorId(COLLECTION_STATS, userId) || {};
                const newStats = {
                    userId,
                    username: resultado.username || 'Usuario',
                    puntajeTotal: (currentStats.puntajeTotal || 0) + (resultado.puntaje || 0),
                    partidasJugadas: (currentStats.partidasJugadas || 0) + 1,
                    ultimaPartida: new Date().toISOString()
                };
                await firestoreService.crear(COLLECTION_STATS, { id: userId, ...newStats });
            }
        }

        console.log('✅ Resultado guardado para:', userId);
        return statsData;
    } catch (error) {
        console.error('❌ Error guardando resultado:', error);
    }
};

const obtenerRankingGlobal = async (limite = 50) => {
    try {
        let rankingList = [];
        try {
            // ⚡ INTENTO OPTIMIZADO
            const snapshot = await db.collection(COLLECTION_STATS)
                .orderBy('puntajeTotal', 'desc')
                .limit(limite)
                .get();

            rankingList = snapshot.docs.map((doc, index) => {
                const data = doc.data();
                return {
                    ...data,
                    nombre: data.username,
                    promedio: data.partidasJugadas ? parseFloat((data.puntajeTotal / data.partidasJugadas).toFixed(2)) : 0,
                    posicion: index + 1
                };
            });
        } catch (dbError) {
            // FALLBACK MEMORIA
            if (dbError.message.includes('Could not load') || dbError.message.includes('Project Id')) {
                console.warn('⚠️ [RANKING] Fallback a memoria por falta de credenciales');
                const allStats = await firestoreService.obtenerTodos(COLLECTION_STATS);
                rankingList = allStats
                    .sort((a, b) => b.puntajeTotal - a.puntajeTotal)
                    .slice(0, limite)
                    .map((u, index) => ({
                        ...u,
                        nombre: u.username,
                        promedio: u.partidasJugadas ? parseFloat((u.puntajeTotal / u.partidasJugadas).toFixed(2)) : 0,
                        posicion: index + 1
                    }));
            } else {
                throw dbError;
            }
        }

        // Recuperar los correos (emails) desde Firebase Auth
        try {
            const uids = rankingList
                .filter(r => r.userId && r.userId.length > 5)
                .map(r => ({ uid: r.userId }));
                
            if (uids.length > 0) {
                const result = await admin.auth().getUsers(uids);
                const emailMap = {};
                result.users.forEach(u => emailMap[u.uid] = u.email);
                
                rankingList = rankingList.map(r => ({
                    ...r,
                    email: emailMap[r.userId] || 'Email no disponible'
                }));
            } else {
                rankingList = rankingList.map(r => ({ ...r, email: 'Email no disponible' }));
            }
        } catch (err) {
            console.warn('⚠️ [RANKING] No se pudieron obtener los correos de Auth:', err.message);
            rankingList = rankingList.map(r => ({ ...r, email: r.userId })); // Fallback
        }

        return rankingList;

    } catch (error) {
        console.error('❌ Error obteniendo ranking:', error);
        throw error;
    }
};

module.exports = {
    obtenerEstadisticasPersonales,
    guardarResultado,
    obtenerRankingGlobal,
    obtenerResultadosPorSala
};
