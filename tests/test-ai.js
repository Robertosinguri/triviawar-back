require('dotenv').config();
const aiService = require('../src/services/aiService');

async function testGemini() {
    console.log('🧪 Iniciando prueba de Gemini API...');

    const tematicas = ['Historia de Roma', 'Tecnología', 'Cine de los 90'];
    const dificultad = 'medium';

    try {
        console.log(`📡 Solicitando cuestionario para: ${tematicas.join(', ')} (Dificultad: ${dificultad})`);
        const result = await aiService.generateQuestions(tematicas, dificultad);

        if (result.success) {
            console.log('\n✅ ¡ÉXITO! La IA generó las preguntas correctamente.');
            console.log(`🤖 Modelo usado: ${result.aiUsada}`);
            console.log(`⏱️  Tiempo de respuesta: ${result.duration}ms`);
            console.log('\n--- PREGUNTAS GENERADAS ---');

            result.preguntas.forEach((p, index) => {
                console.log(`\n${index + 1}. ${p.pregunta}`);
                p.opciones.forEach((opt, i) => {
                    console.log(`   ${String.fromCharCode(65 + i)}) ${opt} ${i === p.respuestaCorrecta ? '👈 (CORRECTA)' : ''}`);
                });
                console.log(`Tag: ${p.tematica}`);
            });
            console.log('\n---------------------------');
        } else {
            console.error('\n❌ ERROR en la respuesta de la IA:');
            console.error(result.message);
        }
    } catch (error) {
        console.error('\n💥 ERROR FATAL ejecutando la prueba:');
        console.error(error);
    }
}

testGemini();

