require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-3.1-flash-lite-preview";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

async function testGemini() {
    console.log(`🧪 Probando Plan E (Gemini - ${GEMINI_MODEL})...`);

    if (!GEMINI_API_KEY) {
        console.error('❌ Error: GEMINI_API_KEY no encontrada en .env');
        return;
    }

    try {
        const response = await fetch(GEMINI_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                system_instruction: {
                    parts: [{ text: "Responde solo con JSON: [{\"pregunta\": \"...\", \"opciones\": [], \"answer\": 0, \"category\": \"\"}]" }]
                },
                contents: [
                    { role: "user", parts: [{ text: "Una pregunta sobre Linux" }] }
                ],
                generationConfig: {
                    temperature: 0.1,
                    responseMimeType: "application/json"
                }
            })
        });

        const result = await response.json();

        if (result.error) {
            console.error('\n❌ ERROR API GEMINI:');
            console.error(JSON.stringify(result, null, 2));
        } else {
            const parts = result.candidates?.[0]?.content?.parts || [];
            const lastPart = parts[parts.length - 1] || {};
            const content = lastPart.text || parts[0]?.text || "";

            console.log('\n✅ ¡ÉXITO!');
            console.log('--- RESPUESTA ---');
            console.log(content);
        }

    } catch (error) {
        console.error('\n💥 Error conexión:', error.message);
    }
}

testGemini();
