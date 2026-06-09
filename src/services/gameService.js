const roomRepository = require('../repositories/roomRepository');
const aiService = require('./aiService');

const startGame = async (roomCode) => {
    console.log(`🎮 Iniciando juego en sala ${roomCode}`);

    // 1. Obtener estado actual de la sala
    const room = await roomRepository.getRoom(roomCode);
    if (!room) throw new Error('Sala no encontrada');

    // 🛡️ PROTECCIÓN: Evitar múltiples llamadas simultáneas a la IA
    if (room.estado === 'generating' || room.estado === 'playing') {
        console.warn(`⚠️ La sala ${roomCode} ya está generando preguntas. Ignorando solicitud duplicada.`);
        throw new Error('El juego ya se está iniciando, por favor espera...');
    }

    // 2. Recopilar preferencias de todos los jugadores
    // Extraemos todas las temáticas y dificultades seleccionadas
    const tematicas = new Set();

    room.jugadores.forEach(j => {
        if (j.tematica) tematicas.add(j.tematica);
    });

    // Si nadie eligió nada, usamos defaults
    const listaTematicas = tematicas.size > 0 ? Array.from(tematicas) : ['General'];

    console.log(`🎯 Temáticas recolectadas para la partida: ${listaTematicas.join(', ')}`);

    try {
        // 🔒 BLOQUEO: Marcar sala como "generando" para bloquear otros clics
        await roomRepository.updateRoom(roomCode, { estado: 'generating' });

        // 3. Generar preguntas con IA
        console.log(`🤖 Solicitando preguntas para: ${listaTematicas.join(', ')}`);
        const resultAI = await aiService.generateQuestions(listaTematicas);

        if (!resultAI.success) {
            console.error('❌ IA falló generando preguntas:', resultAI.message);
            await roomRepository.updateRoom(roomCode, { estado: 'waiting' });
            throw new Error(resultAI.message || 'Error generando preguntas con IA');
        }

        // 4. Actualizar estado de sala
        const updates = {
            estado: 'playing',
            preguntasActuales: resultAI.preguntas, // Guardamos temporalmente las preguntas en la sala
            fechaInicioJuego: new Date().toISOString()
        };

        await roomRepository.updateRoom(roomCode, updates);

        return {
            success: true,
            preguntas: resultAI.preguntas,
            dificultad: 'mixed', // 🎯 Dificultad mixta
            tematicas: listaTematicas,   // 📚 Incluir temáticas usadas
            aiInfo: {
                model: resultAI.aiUsada,
                duration: resultAI.duration
            }
        };

    } catch (error) {
        console.error('❌ Error iniciando juego:', error);
        throw error;
    }
};

const submitResult = async (roomCode, resultData) => {
    // Aquí implementaremos la lógica de guardar resultados finales
    // y determinar si todos terminaron
    return { success: true };
};

module.exports = {
    startGame,
    submitResult
};
