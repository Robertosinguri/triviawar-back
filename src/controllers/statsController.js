const statsService = require('../services/statsService');

const getMyStats = async (req, res) => {
    try {
        const { userId, username } = req.query;
        if (!userId) return res.status(400).json({ error: 'userId is required' });

        const stats = await statsService.obtenerEstadisticasPersonales(userId, username);
        res.json({ success: true, stats });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getGlobalRanking = async (req, res) => {
    try {
        const { limite } = req.query;
        const ranking = await statsService.obtenerRankingGlobal(limite ? parseInt(limite) : 50);
        res.json({ success: true, ranking });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getMyStats,
    getGlobalRanking
};
