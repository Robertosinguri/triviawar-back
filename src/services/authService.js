const axios = require('axios');
const { auth, db } = require('../config/firebase');

const FIREBASE_API_KEY = process.env.FIREBASE_WEB_API_KEY;

const login = async (email, password) => {
    try {
        const response = await axios.post(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
            {
                email,
                password,
                returnSecureToken: true
            }
        );

        const { localId, displayName, email: userEmail, idToken, photoUrl } = response.data;

        // 🎯 RECUPERACIÓN DE PERFIL EXTENDIDO (Como en Cognito)
        // Buscamos si tenemos un avatar personalizado guardado en nuestra DB
        let picture = photoUrl || '';
        try {
            const COLLECTION_STATS = 'mvpp-estadisticas';
            const userDoc = await db.collection(COLLECTION_STATS).doc(localId).get();
            if (userDoc.exists && userDoc.data().picture) {
                picture = userDoc.data().picture;
                console.log(`ℹ️ [AUTH] Usando avatar de Firestore para ${userEmail}: ${picture}`);
            }
        } catch (dbError) {
            console.warn('⚠️ [AUTH] No se pudo leer el perfil de Firestore al login:', dbError.message);
        }

        console.log(`✅ Login exitoso: ${userEmail} (Avatar final: ${picture || 'ninguno'})`);

        return {
            uid: localId,
            username: displayName || userEmail.split('@')[0],
            email: userEmail,
            name: displayName,
            picture: picture,
            token: idToken
        };
    } catch (error) {
        console.error('❌ Error en authService.login:', error.response?.data?.error?.message || error.message);
        throw new Error(error.response?.data?.error?.message || 'Error de autenticación');
    }
};

const signUp = async (email, password, displayName) => {
    try {
        // 1. Crear usuario en Firebase con Admin SDK
        const userRecord = await auth.createUser({
            email,
            password,
            displayName
        });

        // 2. Hacer login para obtener el token (necesario para disparar el email de verificación)
        const authData = await login(email, password);

        // 3. Disparar email de verificación vía REST API
        try {
            await axios.post(
                `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`,
                {
                    requestType: 'VERIFY_EMAIL',
                    idToken: authData.token
                }
            );
            console.log(`✉️ [AUTH] Email de verificación disparado para ${email}`);
        } catch (emailError) {
            console.error('⚠️ [AUTH] No se pudo enviar el correo de verificación (no crítico):', 
                emailError.response?.data?.error?.message || emailError.message);
        }

        return authData;



    } catch (error) {
        console.error('❌ Error en authService.signUp:', error.message);
        throw new Error(error.message);
    }
};

const resendVerification = async (email, password) => {
    try {
        // Necesitamos un token fresco para enviar el correo
        const authData = await login(email, password);
        
        await axios.post(
            `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`,
            {
                requestType: 'VERIFY_EMAIL',
                idToken: authData.token
            }
        );
        
        console.log(`✉️ [AUTH] Reenvío de verificación exitoso para ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Error en resendVerification:', error.response?.data?.error?.message || error.message);
        throw new Error(error.response?.data?.error?.message || 'Error al reenviar verificación');
    }
};

const sendPasswordReset = async (email) => {
    try {
        await axios.post(
            `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`,
            {
                requestType: 'PASSWORD_RESET',
                email
            }
        );
        console.log(`✉️ [AUTH] Email de reseteo enviado a ${email}`);
        return true;
    } catch (error) {
        const errorMsg = error.response?.data?.error?.message || error.message;
        console.error('❌ Error detallado en sendPasswordReset:', errorMsg);
        
        // Traducción de errores comunes de Firebase
        if (errorMsg === 'EMAIL_NOT_FOUND') {
            throw new Error('El correo electrónico no está registrado en el sistema.');
        }
        
        throw new Error(errorMsg || 'Error al enviar reseteo de contraseña');
    }
};




const verifyToken = async (idToken) => {
    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        return decodedToken;
    } catch (error) {
        console.error('❌ Error verificando token:', error.message);
        throw error;
    }
};

const updateProfile = async (uid, updates) => {
    try {
        console.log(`🔧 [AUTH] Intentando actualizar perfil para UID: ${uid}`);

        // 1. Preparar campos para Firebase Auth
        const authUpdates = {};

        if (updates.picture) {
            // 🎯 ESTRATEGIA: Solo actualizamos el campo nativo de Firebase si es una URL real
            // Si es un nombre de archivo local (12.png), lo gestionamos SOLO vía Firestore/Login
            if (updates.picture.startsWith('http')) {
                authUpdates.photoURL = updates.picture;
            }
        }

        if (updates.name) authUpdates.displayName = updates.name;

        // Intentar actualización en Auth
        const userRecord = await auth.updateUser(uid, authUpdates);
        console.log(`✅ [AUTH] Firebase Auth actualizado para ${uid}`);

        // 2. Actualizar en Firestore (Estadísticas/Ranking)
        try {
            const COLLECTION_STATS = 'mvpp-estadisticas';
            const userStatsRef = db.collection(COLLECTION_STATS).doc(uid);

            const firestoreUpdates = {};
            if (updates.picture) firestoreUpdates.picture = updates.picture;
            if (updates.name) firestoreUpdates.username = updates.name;

            if (Object.keys(firestoreUpdates).length > 0) {
                await userStatsRef.set(firestoreUpdates, { merge: true });
                console.log(`✅ [AUTH] Firestore persistido para ${uid}`);
            }
        } catch (dbError) {
            console.warn('⚠️ [AUTH] No se pudo persistir en Firestore (no es crítico):', dbError.message);
        }

        return userRecord;
    } catch (error) {
        console.error('❌ [AUTH] Error crítico en updateProfile:', error.message);
        throw error;
    }
};

module.exports = {
    login,
    signUp,
    verifyToken,
    updateProfile,
    resendVerification,
    sendPasswordReset
};
