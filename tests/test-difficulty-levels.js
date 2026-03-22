require('dotenv').config();
const aiService = require('../src/services/aiService');

/**
 * Script de prueba para verificar que los 3 niveles de dificultad
 * generen preguntas apropiadas según el prompt optimizado
 */

const TEMATICAS_PRUEBA = ['Python', 'JavaScript'];

async function probarNivel(dificultad) {
    console.log('\n' + '='.repeat(80));
    console.log(`🎯 PROBANDO NIVEL: ${dificultad.toUpperCase()}`);
    console.log('='.repeat(80));

    try {
        const resultado = await aiService.generateQuestions(TEMATICAS_PRUEBA, dificultad);

        if (resultado.success) {
            console.log(`\n✅ Generación exitosa con: ${resultado.aiUsada}`);
            console.log(`⏱️  Tiempo: ${resultado.duration}ms\n`);

            resultado.preguntas.forEach((pregunta, index) => {
                console.log(`\n📝 PREGUNTA ${index + 1}:`);
                console.log(`   Categoría: ${pregunta.tematica}`);
                console.log(`   Pregunta: ${pregunta.pregunta}`);
                console.log(`   Opciones:`);
                pregunta.opciones.forEach((opcion, i) => {
                    const esCorrecta = i === pregunta.respuestaCorrecta ? '✓' : ' ';
                    console.log(`      [${esCorrecta}] ${String.fromCharCode(65 + i)}. ${opcion}`);
                });
            });

            // Análisis de complejidad
            console.log('\n📊 ANÁLISIS DE COMPLEJIDAD:');
            const longitudPromedio = resultado.preguntas.reduce((acc, p) => acc + p.pregunta.length, 0) / resultado.preguntas.length;
            console.log(`   - Longitud promedio de pregunta: ${Math.round(longitudPromedio)} caracteres`);

            const tieneNumeros = resultado.preguntas.filter(p => /\d/.test(p.pregunta)).length;
            console.log(`   - Preguntas con números/fechas: ${tieneNumeros}/${resultado.preguntas.length}`);

            const tieneTecnicismos = resultado.preguntas.filter(p =>
                /\(|\)|\.|\[|\]|<|>|función|método|parámetro|argumento|clase|objeto/.test(p.pregunta.toLowerCase())
            ).length;
            console.log(`   - Preguntas con tecnicismos: ${tieneTecnicismos}/${resultado.preguntas.length}`);

        } else {
            console.log(`\n❌ Error: ${resultado.message}`);
        }

    } catch (error) {
        console.error(`\n💥 Error fatal: ${error.message}`);
    }
}

async function ejecutarPruebas() {
    console.log('\n🧪 INICIANDO PRUEBAS DE NIVELES DE DIFICULTAD');
    console.log('Temáticas: ' + TEMATICAS_PRUEBA.join(', '));
    console.log('Fecha: ' + new Date().toLocaleString());

    // Probar los 3 niveles en secuencia
    await probarNivel('baby');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Pausa entre llamadas

    await probarNivel('conocedor');
    await new Promise(resolve => setTimeout(resolve, 2000));

    await probarNivel('killer');

    console.log('\n' + '='.repeat(80));
    console.log('✅ PRUEBAS COMPLETADAS');
    console.log('='.repeat(80));
    console.log('\n💡 ANÁLISIS:');
    console.log('   - Baby: Debería tener preguntas cortas, vocabulario simple');
    console.log('   - Conocedor: Preguntas de nivel medio, conceptos estándar');
    console.log('   - Killer: Preguntas largas, fechas exactas, edge cases, tecnicismos\n');
}

ejecutarPruebas();
