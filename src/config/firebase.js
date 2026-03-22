const admin = require('firebase-admin');
const path = require('path');

try {
    let serviceAccount = null;

    // Opción 1: JSON crudo en variable de entorno (Ideal para Producción/Render/Vercel)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        try {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
            console.log('🔥 Firebase Admin: Credenciales cargadas desde variable JSON');
        } catch (e) {
            console.error('❌ Error parseando FIREBASE_SERVICE_ACCOUNT_JSON:', e.message);
        }
    }
    
    // Opción 2: Ruta al archivo (Ideal para Desarrollo Local)
    if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
        try {
            // Resolvemos la ruta relativa desde la raíz del proyecto de forma segura
            const keyPath = path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
            serviceAccount = require(keyPath);
            console.log('🔥 Firebase Admin: Credenciales cargadas desde archivo local');
        } catch (e) {
            console.error(`❌ Error leyendo archivo de credenciales en ${process.env.FIREBASE_SERVICE_ACCOUNT_PATH}:`, e.message);
        }
    }

    if (serviceAccount) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } else {
        // Opción 3: Fallback (Suele fallar en local sin gcloud CLI configurado)
        admin.initializeApp({
            projectId: 'mvpp-65c73'
        });
        console.log(`
  ⚠️  Firebase Admin iniciado en modo FALLBACK (Sin Service Account).
  👉  Para solucionar errores de permisos:
      1. Descarga el JSON de "Service Accounts" en Firebase Console.
      2. Guárdalo como 'service-account.json' en la raíz.
      3. Agrega a .env: FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json
        `);
    }
} catch (error) {
    console.error('❌ Error inicializando Firebase:', error.message);
    // No matamos el proceso, pero los servicios de DB fallarán si se usan
}

const db = admin.firestore();
const auth = admin.auth();

module.exports = {
    admin,
    db,
    auth
};
