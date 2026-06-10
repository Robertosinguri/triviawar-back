/**
 * Script de recuperación de ranking.
 * USO: node scripts/restore-ranking.js
 * NO es parte del servidor. Solo se ejecuta manualmente si es necesario.
 */
require('dotenv').config();
const { db, admin } = require('../src/config/firebase');

const rankingData = [
    { username: "Ari2", email: "ariadnapradoaps@gmail.com", puntajeTotal: 1071, partidasJugadas: 30 },
    { username: "Anto", email: "antonellazacagnino@gmail.com", puntajeTotal: 1041, partidasJugadas: 10 },
    { username: "Gera", email: "gerarevrol@gmail.com", puntajeTotal: 942, partidasJugadas: 9 },
    { username: "robertosinguri", email: "robertosinguri@gmail.com", puntajeTotal: 760, partidasJugadas: 16 },
    { username: "jesi", email: "jesicaguerrerof@gmail.com", puntajeTotal: 710, partidasJugadas: 7 },
    { username: "María Lucía", email: "marialucia.santagata@gmail.com", puntajeTotal: 660, partidasJugadas: 4 },
    { username: "Emma Arduini", email: "arduiniemma@gmail.com", puntajeTotal: 620, partidasJugadas: 10 },
    { username: "Sergio", email: "s.rodriguez0287@gmail.com", puntajeTotal: 610, partidasJugadas: 4 },
    { username: "Luli", email: "conloqueesoduele@gmail.com", puntajeTotal: 600, partidasJugadas: 4 },
    { username: "j", email: "arielwdev@gmail.com", puntajeTotal: 590, partidasJugadas: 4 },
    { username: "Monsieur Pichon", email: "monsieur.pichon@gmail.com", puntajeTotal: 440, partidasJugadas: 4 },
    { username: "jkac2012", email: "jkac2012@gmail.com", puntajeTotal: 280, partidasJugadas: 5 },
    { username: "flyingsheep", email: "robertosinguri@hotmail.com", puntajeTotal: 110, partidasJugadas: 6 },
    { username: "admi", email: "adm.moriblock@gmail.com", puntajeTotal: 100, partidasJugadas: 1 },
    { username: "Wardaddy", email: "gabrielomarrolon1996@gmail.com", puntajeTotal: 100, partidasJugadas: 2 },
    { username: "ariadnaprado2002", email: "ariadnaprado2002@gmail.com", puntajeTotal: 80, partidasJugadas: 3 },
    { username: "Luis Duran", email: "luisduran1209@gmail.com", puntajeTotal: 20, partidasJugadas: 1 },
    { username: "Yoguini Namaskar", email: "yoguininamaskar@gmail.com", puntajeTotal: 20, partidasJugadas: 1 },
    { username: "Ivan", email: "ivan123@gmail.com", puntajeTotal: 2, partidasJugadas: 1 }
];

(async () => {
    try {
        // Borrar entradas viejas con email como key
        const oldSnap = await db.collection('mvpp-estadisticas').get();
        const deleteBatch = db.batch();
        let deletedOld = 0;
        oldSnap.docs.forEach(doc => {
            if (doc.id.includes('@')) {
                deleteBatch.delete(doc.ref);
                deletedOld++;
            }
        });
        if (deletedOld > 0) {
            await deleteBatch.commit();
            console.log(`🗑️ ${deletedOld} entradas viejas (email-keyed) eliminadas`);
        }

        // Resolver UIDs desde Firebase Auth
        const emails = rankingData.filter(p => p.email).map(p => ({ email: p.email }));
        const result = await admin.auth().getUsers(emails);
        const emailToUid = {};
        result.users.forEach(u => {
            if (u.email) emailToUid[u.email] = u.uid;
        });

        // Escribir con UID correcto
        const batch = db.batch();
        let count = 0;
        const fallbacks = [];

        for (const player of rankingData) {
            if (!player.email) continue;
            const uid = emailToUid[player.email];
            if (!uid) {
                fallbacks.push(player.username);
                continue;
            }
            const ref = db.collection('mvpp-estadisticas').doc(uid);
            batch.set(ref, {
                userId: uid,
                username: player.username,
                email: player.email,
                puntajeTotal: player.puntajeTotal,
                partidasJugadas: player.partidasJugadas,
                ultimaPartida: new Date().toISOString()
            });
            count++;
        }

        await batch.commit();

        console.log(`✅ Ranking restaurado: ${count} jugadores (UID-keyed)`);
        if (fallbacks.length > 0) console.log(`⚠️ Sin UID en Auth: ${fallbacks.join(', ')}`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
})();
