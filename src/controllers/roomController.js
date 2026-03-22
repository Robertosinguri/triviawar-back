const roomService = require('../services/roomService');

const getRoom = async (req, res) => {
    try {
        const { code } = req.params;
        if (!code) return res.status(400).json({ error: 'Código de sala requerido' });

        const room = await roomService.getRoom(code);
        if (!room) return res.status(404).json({ error: 'Sala no encontrada' });

        res.json(room);
    } catch (error) {
        console.error('❌ Error en roomController.getRoom:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getRoom
};
