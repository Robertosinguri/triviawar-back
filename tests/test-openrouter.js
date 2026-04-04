require('dotenv').config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "liquid/lfm-2.5-1.2b-thinking:free";

async function testOpenRouter() {
    console.log('🧪 Probando OpenRouter API...');
    console.log('===============================');

    if (!OPENROUTER_API_KEY) {
        console.error('❌ Error: OPENROUTER_API_KEY no encontrada en .env');
        console.log('👉 Obtén una clave en: https://openrouter.ai/keys');
        return;
    }

    console.log(`🔑 API Key: ${OPENROUTER_API_KEY.substring(0, 10)}...`);
    console.log(`🤖 Modelo: ${OPENROUTER_MODEL}`);
    console.log('🌐 URL:', OPENROUTER_URL);

    // Test 1: Conexión básica
    console.log('\n1️⃣  Test de Conexión Básica...');
    try {
        const startTime = Date.now();
        const response = await fetch(OPENROUTER_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://triviawar.com",
                "X-Title": "Trivia War"
            },
            body: JSON.stringify({
                model: OPENROUTER_MODEL,
                messages: [
                    {
                        role: "user",
                        content: "Responde solo la palabra ¡LISTO!."
                    }
                ],
                temperature: 0.7,
                max_tokens: 10
            })
        });

        const duration = Date.now() - startTime;

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ HTTP ${response.status}: ${errorText}`);
            return;
        }

        const result = await response.json();
        const text = result.choices?.[0]?.message?.content || "";

        console.log(`✅ Conexión exitosa (${duration}ms)`);
        console.log(`📝 Respuesta: "${text}"`);
        console.log(`🆔 ID: ${result.id || 'N/A'}`);
        console.log(`📊 Tokens usados: ${result.usage?.total_tokens || 'N/A'}`);

    } catch (error) {
        console.error('❌ Error en test de conexión:', error.message);
        return;
    }

    // Test 2: Generación de preguntas de trivia
    console.log('\n2️⃣  Test de Generación de Trivia...');
    try {
        const SYSTEM_INSTRUCTION = `Eres un Maestro de Trivia Profesional.
Tu única misión es generar un JSON que contenga exactamente 2 preguntas de alta calidad.
- Formato: Array de objetos JSON.
- Nivel de dificultad: Baby (muy fácil).
- Regla de Respuesta: El campo "respuestaCorrecta" DEBE ser el índice exacto (0-3).
- Salida: ÚNICAMENTE el código JSON puro, sin explicaciones ni markdown.`;

        const prompt = `ACTÚA COMO UN PROFESOR DE PRIMARIA AMABLE.
GENERA 2 PREGUNTAS EN NIVEL MUY FÁCIL (Nivel Principiante) sobre: Programación.

REGLAS DE DOMINIO PARA ESTA SESIÓN:
- DISTRIBUCIÓN: 2 de "Programación"
- RIGOR: Usa lenguaje simple, conceptos básicos y cultura general masiva. Las opciones deben ser muy fáciles de descartar.

FORMATO JSON OBLIGATORIO (Array de objetos):
[
  {
    "pregunta": "texto de la pregunta técnico y profesional",
    "opciones": ["...", "...", "...", "..."],
    "respuestaCorrecta": 0,
    "tematica": "categoría"
  }
]

REGLAS CRÍTICAS:
- El índice "respuestaCorrecta" (0-3) debe ser exacto.
- NO uses markdown (\`\`\`json).
- EVITA preguntas de cultura general. Sé específico hasta la médula técnica.`;

        const startTime = Date.now();
        const response = await fetch(OPENROUTER_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://triviawar.com",
                "X-Title": "Trivia War"
            },
            body: JSON.stringify({
                model: OPENROUTER_MODEL,
                messages: [
                    { role: "system", content: SYSTEM_INSTRUCTION },
                    { role: "user", content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 1000
            })
        });

        const duration = Date.now() - startTime;

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ HTTP ${response.status}: ${errorText}`);
            return;
        }

        const result = await response.json();
        const text = result.choices?.[0]?.message?.content || "";

        if (!text) {
            console.error('❌ Respuesta vacía de OpenRouter');
            return;
        }

        console.log(`✅ Generación exitosa (${duration}ms)`);

        // Limpiar y parsear JSON
        let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const startIdx = cleaned.indexOf('[');
        const endIdx = cleaned.lastIndexOf(']');

        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
            cleaned = cleaned.substring(startIdx, endIdx + 1);
        }

        try {
            const preguntas = JSON.parse(cleaned);
            console.log(`📊 Preguntas generadas: ${Array.isArray(preguntas) ? preguntas.length : 1}`);

            if (Array.isArray(preguntas)) {
                preguntas.forEach((p, i) => {
                    console.log(`\n   Pregunta ${i + 1}:`);
                    console.log(`   📝: ${p.pregunta || p.question || 'Sin texto'}`);
                    console.log(`   🏷️ : ${p.tematica || p.category || 'General'}`);
                    console.log(`   ✅ Respuesta correcta: índice ${p.respuestaCorrecta || p.answer || 0}`);
                    console.log(`   📋 Opciones: ${JSON.stringify(p.opciones || p.options || [])}`);
                });
            }

            console.log(`📈 Tokens totales: ${result.usage?.total_tokens || 'N/A'}`);

        } catch (parseError) {
            console.error('❌ Error parseando JSON:', parseError.message);
            console.log('📄 Respuesta cruda:', text.substring(0, 200) + '...');
        }

    } catch (error) {
        console.error('❌ Error en generación de trivia:', error.message);
        return;
    }

    // Test 3: Performance y timeout
    console.log('\n3️⃣  Test de Performance...');
    try {
        const startTime = Date.now();
        const response = await fetch(OPENROUTER_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: OPENROUTER_MODEL,
                messages: [
                    {
                        role: "user",
                        content: "¿Cuál es la capital de Francia?"
                    }
                ],
                max_tokens: 5
            })
        });

        const duration = Date.now() - startTime;

        if (response.ok) {
            console.log(`✅ Performance: ${duration}ms`);

            if (duration < 1000) {
                console.log('🚀 Excelente velocidad (< 1s)');
            } else if (duration < 3000) {
                console.log('⚡ Buena velocidad (< 3s)');
            } else {
                console.log('🐌 Velocidad aceptable');
            }
        } else {
            console.error(`❌ Error en test de performance: HTTP ${response.status}`);
        }

    } catch (error) {
        console.error('❌ Error en test de performance:', error.message);
    }

    console.log('\n===============================');
    console.log('🧪 Tests completados');
    console.log('👉 Para ejecutar en producción:');
    console.log('   node tests/test-openrouter.js');
}

// Ejecutar test si se llama directamente
if (require.main === module) {
    testOpenRouter().catch(error => {
        console.error('❌ Error fatal:', error);
        process.exit(1);
    });
}

module.exports = { testOpenRouter };
