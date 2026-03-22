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
    const dificultades = new Set();

    room.jugadores.forEach(j => {
        if (j.tematica) tematicas.add(j.tematica);
        if (j.dificultad) dificultades.add(j.dificultad);
    });

    // Si nadie eligió nada, usamos defaults
    const listaTematicas = tematicas.size > 0 ? Array.from(tematicas) : ['General'];

    // 🎯 FIX: Selección inteligente de dificultad
    let dificultadFinal = 'baby'; // Default seguro
    if (dificultades.size > 0) {
        const difs = Array.from(dificultades);
        // Si hay múltiples dificultades, priorizar la más difícil
        if (difs.includes('killer')) dificultadFinal = 'killer';
        else if (difs.includes('conocedor')) dificultadFinal = 'conocedor';
        else dificultadFinal = difs[0]; // Tomar la primera si no hay killer/conocedor
    }

    console.log(`🎯 Dificultad seleccionada: ${dificultadFinal} (de opciones: ${Array.from(dificultades).join(', ') || 'ninguna'})`);

    try {
        // 🔒 BLOQUEO: Marcar sala como "generando" para bloquear otros clics
        await roomRepository.updateRoom(roomCode, { estado: 'generating' });

        // 3. Generar preguntas con IA
        console.log(`🤖 Solicitando preguntas para: ${listaTematicas.join(', ')} | Dificultad: ${dificultadFinal}`);
        const resultAI = await aiService.generateQuestions(listaTematicas, dificultadFinal);

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
            dificultad: dificultadFinal, // 🎯 Incluir dificultad usada
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
