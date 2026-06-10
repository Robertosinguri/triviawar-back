const aiService = require('../services/aiService');
const statsService = require('../services/statsService');
const roomService = require('../services/roomService');
const { admin } = require('../config/firebase');

async function enriquecerConFotos(players) {
    if (!players || players.length === 0) return players;
    try {
        const uids = players.filter(p => p.id && p.id.length > 5).map(p => p.id);
        if (uids.length === 0) return players;

        // 1. Buscar avatar personalizado en mvpp-estadisticas
        const db = require('../config/firebase').db;
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

        // 2. Buscar photoURL de Google en Firebase Auth
        const result = await admin.auth().getUsers(uids.map(uid => ({ uid })));
        const authPicture = {};
        result.users.forEach(u => { authPicture[u.uid] = u.photoURL || null; });

        // 3. Prioridad: avatar personalizado > foto Google > null
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

const generateQuestions = async (req, res) => {
    try {
        const { tematicas, dificultad, count, isEntrenamiento } = req.body;

        if (!tematicas || !Array.isArray(tematicas) || tematicas.length === 0) {
            return res.status(400).json({ error: 'Se requieren temáticas (array)' });
        }

        let result;
        if (isEntrenamiento) {
            console.log(`🏋️ Ejecutando Motor de Entrenamiento para: ${tematicas[0]}`);
            result = await aiService.generateTrainingQuestions(tematicas[0], dificultad, count || 5);
        } else {
            console.log(`🎮 Ejecutando Motor Competitivo para: ${tematicas.join(', ')}`);
            result = await aiService.generateQuestions(tematicas);
        }

        res.json(result);

    } catch (error) {
        console.error('❌ Error en gameController.generateQuestions:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Error generando preguntas'
        });
    }
};

const submitResult = async (req, res) => {
    try {
        const resultData = req.body;
        const { userId, roomCode } = resultData;

        console.log(`📥 [API] submitResult recibido -> User: ${userId} | Room: ${roomCode}`);

        if (!userId) {
            return res.status(400).json({ error: 'Se requiere userId' });
        }

        // 🛡️ NORMALIZACIÓN DE INPUTS (Manejo de alias por unificación de componentes)
        // Aceptamos variantes como 'aciertos' vs 'respuestasCorrectas' o 'tiempo' vs 'tiempoTotal'
        const puntaje = parseInt(resultData.puntaje) || parseInt(resultData.score) || 0;
        const respuestasCorrectas = parseInt(resultData.respuestasCorrectas) || parseInt(resultData.aciertos) || 0;
        const totalPreguntas = parseInt(resultData.totalPreguntas) || parseInt(resultData.total) || 0;
        const tiempoTotal = parseInt(resultData.tiempoTotal) || parseInt(resultData.tiempo) || 0;

        // Fix Categorías: Si viene array 'tematicas' pero falta string 'tematica', lo creamos
        if (Array.isArray(resultData.tematicas) && !resultData.tematica) {
            resultData.tematica = resultData.tematicas.join(', ');
        }

        // Actualizamos el objeto con los valores normalizados para guardarlos limpios
        resultData.puntaje = puntaje;
        resultData.respuestasCorrectas = respuestasCorrectas;
        resultData.totalPreguntas = totalPreguntas;
        resultData.tiempoTotal = tiempoTotal;

        // Asegurar que roomCode se guarde si existe
        if (roomCode) {
            resultData.roomCode = roomCode;
        }

        const savedResult = await statsService.guardarResultado(userId, resultData);

        let ranking = [];
        let ganador = null;
        let allPlayersFinished = true;
        let playersFinished = 1;
        let totalPlayers = 1;
        let roomPlayers = [];

        if (roomCode) {
            console.log(`🔄 Calculando ranking multijugador para sala: ${roomCode}`);
            const roomResults = await statsService.obtenerResultadosPorSala(roomCode);

            let room = null;
            try {
                room = await roomService.getRoom(roomCode);
            } catch (e) {
                console.warn(`⚠️ No se pudo obtener la sala ${roomCode}, asumiendo 4 jugadores max o usando length actual.`);
            }

            totalPlayers = room && room.jugadores ? room.jugadores.length : (roomResults.length || 4);
            playersFinished = roomResults.length;

            allPlayersFinished = playersFinished >= totalPlayers;

            console.log(`🏁 Progreso Sala ${roomCode}: ${playersFinished}/${totalPlayers} terminados. AllFinished: ${allPlayersFinished}`);

            roomPlayers = room && room.jugadores ? room.jugadores.map(j => {
                const finished = roomResults.some(r => r.userId === j.id);
                return {
                    id: j.id,
                    nombre: j.nombre,
                    esHost: j.esHost || false,
                    terminado: finished
                };
            }) : [];

            roomPlayers = await enriquecerConFotos(roomPlayers);

            ranking = roomResults.map(r => ({
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
            ganador = ranking[0];

            if (allPlayersFinished && room) {
                await roomService.updateRoomStatus(roomCode, 'finalizada', {
                    ranking,
                    ganador,
                    estadisticasEquipo: null
                });
                console.log(`✅ Sala ${roomCode} marcada como FINALIZADA`);
            }

        } else {
            // 👤 LÓGICA SINGLE PLAYER (Entrenamiento)
            const porcentaje = totalPreguntas > 0 ? Math.round((respuestasCorrectas / totalPreguntas) * 100) : 0;
            const playerData = {
                userId: savedResult.userId,
                username: savedResult.username || 'Jugador',
                nombre: savedResult.username || 'Jugador',
                puntaje: savedResult.puntaje || 0,
                tiempoTotal: tiempoTotal,
                porcentaje: porcentaje,
                respuestasCorrectas: respuestasCorrectas,
                totalPreguntas: totalPreguntas,
                tematica: savedResult.tematica || resultData.tematica || 'General',
                posicion: 1
            };
            ranking = [playerData];
            ganador = playerData;
        }

        console.log('📊 Datos a enviar:', {
            savedResult,
            ranking: ranking.length,
            ganador: ganador ? ganador.username : 'N/A',
            allPlayersFinished
        });

        res.json({
            success: true,
            allPlayersFinished,
            playersFinished,
            totalPlayers,
            roomPlayers,
            data: savedResult,
            ranking,
            ganador
        });

    } catch (error) {
        console.error('❌ Error en gameController.submitResult:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Error guardando resultado'
        });
    }
}

module.exports = {
    generateQuestions,
    submitResult
};
