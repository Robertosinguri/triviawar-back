const authService = require('../services/authService');

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email y password son requeridos' });
        }

        const user = await authService.login(email, password);
        res.json({ success: true, user });
    } catch (error) {
        res.status(401).json({ success: false, message: error.message });
    }
};

const signUp = async (req, res) => {
    try {
        const { email, password, name } = req.body;
        if (!email || !password || !name) {
            return res.status(400).json({ success: false, message: 'Faltan campos obligatorios' });
        }

        const user = await authService.signUp(email, password, name);
        res.json({ success: true, user });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const updateProfile = async (req, res) => {
    try {
        const { uid, picture, name } = req.body;
        if (!uid) {
            return res.status(400).json({ success: false, message: 'UID requerido' });
        }

        await authService.updateProfile(uid, { picture, name });
        res.json({ success: true, message: 'Perfil actualizado correctamente' });
    } catch (error) {
        console.error('❌ [CONTROLLER] Error en updateProfile:', error);
        res.status(500).json({
            success: false,
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

module.exports = {
    login,
    signUp,
    updateProfile
};
