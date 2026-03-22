const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { GoogleGenerativeAI } = require('@google/generative-ai');

const API_KEY = process.env.GEMINI_API_KEY;

const MODELS_TO_TEST = [
    "gemini-2.0-flash"       // El modelo elegido
];

async function testGeminiModels() {
    console.log('🧪 DIAGNÓSTICO DE MODELOS GEMINI');
    console.log('================================');

    if (!API_KEY) {
        console.error('❌ Error: GEMINI_API_KEY no encontrada en .env');
        return;
    }

    const genAI = new GoogleGenerativeAI(API_KEY);
    let workingModel = null;

    for (const modelName of MODELS_TO_TEST) {
        process.stdout.write(`👉 Probando modelo: "${modelName}"... `);

        try {
            // Intentamos instanciar y generar algo muy simple
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Hola, responde solo con la palabra OK.");
            const response = await result.response;
            const text = response.text();

            if (text) {
                console.log('✅ FUNCIONA');
                console.log(`   📝 Respuesta: ${text.trim()}`);
                workingModel = modelName;

            }
        } catch (error) {
            console.log('❌ FALLÓ');
            let msg = error.message;
            if (msg.includes('404')) msg = '404 Not Found (Modelo no existe o no tienes acceso)';
            else if (msg.includes('400')) msg = '400 Bad Request (Configuración inválida)';
            else if (msg.includes('403')) msg = '403 Forbidden (API Key inválida o sin permisos)';
            else if (msg.includes('429')) msg = '429 Too Many Requests (Cuota excedida)';

            console.log(`   ⚠️ Causa: ${msg}`);
        }
        // Pequeña pausa para no saturar
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n================================');
    if (workingModel) {
        console.log(`🎉 CONCLUSIÓN: Debes usar el modelo "${workingModel}" en tu código.`);
    } else {
        console.log('💀 CONCLUSIÓN: Ningún modelo funcionó. Revisa tu API Key o tu cuenta de Google Cloud.');
    }
}

testGeminiModels();