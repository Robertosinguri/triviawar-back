require('dotenv').config();
const { db, auth } = require('./src/config/firebase');

async function cleanUp() {
    console.log('🧹 Iniciando limpieza de usuarios huérfanos en el ranking...');
    const COLLECTION_STATS = 'mvpp-estadisticas';
    const COLLECTION_RESULTS = 'mvpp-resultados-partida'; // Opcional, limpiar partidas de usuarios borrados

    const snapshot = await db.collection(COLLECTION_STATS).get();
    let deletedCount = 0;

    for (const doc of snapshot.docs) {
        const uid = doc.id;
        try {
            // Intentamos verificar si el usuario existe en Firebase Auth
            await auth.getUser(uid);
            console.log(`✅ Jugador mantenido (Auth válido): ${uid}`);
        } catch (error) {
            // Si Firebase Auth lanza un error de "user-not-found", significa que fue borrado en la Consola
            if (error.code === 'auth/user-not-found') {
                console.log(`🗑️ Eliminando usuario huérfano del ranking: ${uid} - ${doc.data().username || ''}`);
                
                // 1. Borramos sus estadísticas
                await db.collection(COLLECTION_STATS).doc(uid).delete();
                deletedCount++;

                // 2. (Opcional) Borramos las partidas registradas por ese usuario
                const resultsSnap = await db.collection(COLLECTION_RESULTS).where('userId', '==', uid).get();
                for (const rDoc of resultsSnap.docs) {
                    await db.collection(COLLECTION_RESULTS).doc(rDoc.id).delete();
                }
                if (!resultsSnap.empty) {
                    console.log(`   -> 🗑️ ${resultsSnap.size} partidas eliminadas para este usuario.`);
                }
            } else {
                console.error(`❌ Error verificando a ${uid}:`, error.message);
            }
        }
    }

    console.log(`\n✨ Limpieza terminada exitosamente. Se eliminaron ${deletedCount} jugadores inválidos del ranking.`);
    process.exit(0);
}

cleanUp().catch(console.error);
