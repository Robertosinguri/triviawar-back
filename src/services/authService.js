const axios = require('axios');
const { auth, db } = require('../config/firebase');
const firestoreService = require('./firestoreService');

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

        // 🎯 RECUPERACIÓN DE PERFIL EXTENDIDO
        let picture = photoUrl || '';
        let username = displayName || userEmail.split('@')[0]; // Fallback inicial

        try {
            const COLLECTION_STATS = 'mvpp-estadisticas';
            const userData = await firestoreService.obtenerPorId(COLLECTION_STATS, localId);
            
            if (userData) {
                picture = userData.picture || picture || '01.webp';
                if (userData.username) {
                    username = userData.username;
                    console.log(`ℹ️ [AUTH] Usando alias persistente para ${userEmail}: ${username}`);
                }
            } else {
                // 🛡️ AUTO-CURACIÓN: Si el usuario existe en Firebase pero no en nuestra DB
                await firestoreService.crear(COLLECTION_STATS, {
                    id: localId,
                    username: username,
                    picture: picture || '01.webp',
                    puntos: 0,
                    partidasJugadas: 0,
                    respuestasCorrectas: 0
                });
                console.log(`✅ [AUTH] Perfil auto-generado para usuario: ${userEmail}`);
            }
        } catch (dbError) {
            console.warn('⚠️ [AUTH] No se pudo sincronizar el perfil con la DB:', dbError.message);
        }

        console.log(`✅ Login exitoso: ${userEmail} (Avatar final: ${picture || 'ninguno'})`);

        return {
            uid: localId,
            username: username,
            email: userEmail,
            name: username, // 🛡️ PRIVACIDAD: Nunca enviar el nombre real si tenemos un alias
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

        // 🎯 PERSISTENCIA INICIAL: Crear el perfil en nuestra DB inmediatamente
        try {
            const COLLECTION_STATS = 'mvpp-estadisticas';
            await firestoreService.crear(COLLECTION_STATS, {
                id: userRecord.uid,
                username: displayName,
                picture: '01.webp',
                puntos: 0,
                partidasJugadas: 0,
                respuestasCorrectas: 0
            });
            console.log(`✅ [AUTH] Perfil creado para nuevo usuario: ${email}`);
        } catch (dbError) {
            console.warn('⚠️ [AUTH] Error al crear perfil inicial:', dbError.message);
        }

        // 2. Hacer login para obtener el token
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

        // 2. Actualizar en nuestra DB (Estadísticas/Ranking)
        try {
            const COLLECTION_STATS = 'mvpp-estadisticas';
            const firestoreUpdates = {};
            if (updates.picture) firestoreUpdates.picture = updates.picture;
            if (updates.name) firestoreUpdates.username = updates.name;

            if (Object.keys(firestoreUpdates).length > 0) {
                await firestoreService.actualizar(COLLECTION_STATS, uid, firestoreUpdates);
                console.log(`✅ [AUTH] DB persistida para ${uid}`);
            }
        } catch (dbError) {
            console.warn('⚠️ [AUTH] No se pudo persistir en la DB (no es crítico):', dbError.message);
        }

        return userRecord;
    } catch (error) {
        console.error('❌ [AUTH] Error crítico en updateProfile:', error.message);
        throw error;
    }
};

const googleLogin = async (idToken) => {
    try {
        // 1. Verificar el token recibido del cliente
        const decodedToken = await auth.verifyIdToken(idToken);
        const { uid, email, name, picture: photoUrl } = decodedToken;

        // 2. Sincronizar con nuestra DB (obtener alias y avatar personalizados)
        let picture = photoUrl || '';
        let username = name || email.split('@')[0];
        let isNewUser = false;
        
        try {
            const COLLECTION_STATS = 'mvpp-estadisticas';
            const userData = await firestoreService.obtenerPorId(COLLECTION_STATS, uid);
            
            if (userData) {
                // Si Google tiene foto, SIEMPRE predomina sobre la almacenada en DB
                // Solo usamos la foto de DB si Google no tiene una
                if (photoUrl) {
                    picture = photoUrl;
                    // Mantener Firestore sincronizado con la foto de Google
                    if (userData.picture !== photoUrl) {
                        await firestoreService.actualizar(COLLECTION_STATS, uid, { picture: photoUrl });
                    }
                } else if (userData.picture) {
                    picture = userData.picture;
                }
                if (userData.username) username = userData.username;
                console.log(`ℹ️ [AUTH] Alias recuperado de la DB para ${email}: ${username}`);
            } else {
                isNewUser = true;
                await firestoreService.crear(COLLECTION_STATS, {
                    id: uid,
                    username: username,
                    picture: picture || '01.webp',
                    puntos: 0,
                    partidasJugadas: 0,
                    respuestasCorrectas: 0
                });
            }
        } catch (dbError) {
            console.warn('⚠️ [AUTH] Error sincronizando perfil Google con la DB:', dbError.message);
        }

        console.log(`✅ Google Login exitoso: ${email} (Username: ${username}, Nuevo: ${isNewUser})`);

        return {
            uid,
            username, 
            email,
            name: username, // 🛡️ PRIVACIDAD: Ocultar nombre real de Google
            picture,
            token: idToken,
            isNewUser
        };
    } catch (error) {
        console.error('❌ Error en googleLogin:', error.message);
        throw new Error('Error de autenticación con Google');
    }
};

module.exports = {
    login,
    signUp,
    verifyToken,
    updateProfile,
    resendVerification,
    sendPasswordReset,
    googleLogin
};
