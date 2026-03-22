require('dotenv').config();
const aiService = require('../src/services/aiService');

/**
 * Test rápido para verificar que el modo KILLER genere preguntas técnicas
 * y NO trivia de cultura pop
 */

async function testKillerMode() {
    console.log('\n🔥 PROBANDO MODO KILLER MEJORADO\n');
    console.log('Temáticas: JavaScript, Python');
    console.log('Dificultad: killer\n');

    try {
        const resultado = await aiService.generateQuestions(['JavaScript', 'Python'], 'killer');

        if (resultado.success) {
            console.log(`✅ Generación exitosa con: ${resultado.aiUsada}`);
            console.log(`⏱️  Tiempo: ${resultado.duration}ms\n`);

            let preguntasTecnicas = 0;
            let preguntasTrivia = 0;

            resultado.preguntas.forEach((pregunta, index) => {
                console.log(`\n━━━ PREGUNTA ${index + 1} ━━━`);
                console.log(`📝 ${pregunta.pregunta}`);
                console.log(`📂 Categoría: ${pregunta.tematica}`);

                // Análisis de si es técnica o trivia
                const esTecnica = /\(|\)|función|método|retorna|resultado|comportamiento|código|sintaxis|error|null|undefined|NaN|===|==|\.|\[|\]/.test(pregunta.pregunta.toLowerCase());
                const esTrivia = /año|fecha|creó|lanzó|inventó|fundó|historia|primera vez|cuándo/.test(pregunta.pregunta.toLowerCase());

                if (esTecnica) {
                    console.log('✅ TÉCNICA');
                    preguntasTecnicas++;
                } else if (esTrivia) {
                    console.log('❌ TRIVIA (NO DEBERÍA PASAR)');
                    preguntasTrivia++;
                } else {
                    console.log('⚠️  AMBIGUA');
                }

                pregunta.opciones.forEach((opcion, i) => {
                    const marca = i === pregunta.respuestaCorrecta ? '✓' : ' ';
                    console.log(`   [${marca}] ${String.fromCharCode(65 + i)}. ${opcion}`);
                });
            });

            console.log('\n' + '═'.repeat(60));
            console.log('📊 RESUMEN:');
            console.log(`   Preguntas técnicas: ${preguntasTecnicas}/5`);
            console.log(`   Preguntas de trivia: ${preguntasTrivia}/5`);

            if (preguntasTecnicas >= 4) {
                console.log('\n✅ ÉXITO: El modo killer está generando preguntas técnicas');
            } else if (preguntasTrivia > 2) {
                console.log('\n❌ FALLO: Demasiadas preguntas de trivia');
            } else {
                console.log('\n⚠️  PARCIAL: Mezcla de técnicas y trivia');
            }
            console.log('═'.repeat(60) + '\n');

        } else {
            console.log(`\n❌ Error: ${resultado.message}`);
        }

    } catch (error) {
        console.error(`\n💥 Error fatal: ${error.message}`);
    }
}

testKillerMode();
