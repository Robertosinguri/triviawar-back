const statsService = require('../../services/statsService');

module.exports = (io, socket) => {

    socket.on('get_my_stats', async (data) => {
        try {
            const { userId, username } = data || {};

            if (!userId) {
                console.warn('⚠️ Solicitud de estadísticas sin userId');
                return;
            }

            console.log(`📊 Socket ${socket.id} pide stats para ${userId}`);

            const stats = await statsService.obtenerEstadisticasPersonales(userId, username);

            socket.emit('my_stats_received', stats);

        } catch (error) {
            console.error('❌ Error en get_my_stats:', error);
            socket.emit('error', { message: 'Error obteniendo estadísticas' });
        }
    });
    socket.on('get_global_ranking', async (data) => {
        try {
            const limite = data?.limite || 50;
            const ranking = await statsService.obtenerRankingGlobal(limite);
            socket.emit('global_ranking_received', ranking);
        } catch (error) {
            console.error('❌ Error en get_global_ranking:', error);
            socket.emit('error', { message: 'Error obteniendo ranking' });
        }
    });

    socket.on('save_game_result', async (data) => {
        try {
            const { userId, resultado } = data || {};
            if (!userId || !resultado) return;

            await statsService.guardarResultado(userId, resultado);

            // Opcional: Notificar éxito
            socket.emit('game_result_saved', { success: true });

            // Actualizar sus propias stats inmediatamente para el cliente
            const stats = await statsService.obtenerEstadisticasPersonales(userId, resultado.username);
            socket.emit('my_stats_received', stats);

        } catch (error) {
            console.error('❌ Error en save_game_result:', error);
            socket.emit('error', { message: 'Error guardando resultado' });
        }
    });

};
