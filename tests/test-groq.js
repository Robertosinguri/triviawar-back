require('dotenv').config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

async function testGroq() {
    console.log('🧪 Probando Plan B (Groq - Llama 3 70B)...');

    if (!GROQ_API_KEY) {
        console.error('❌ Error: GROQ_API_KEY no encontrada en .env');
        return;
    }

    try {
        const response = await fetch(GROQ_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [
                    { role: "system", content: "Responde solo con JSON: [{\"pregunta\": \"...\", \"opciones\": [], \"answer\": 0, \"category\": \"\"}]" },
                    { role: "user", content: "Una pregunta sobre Linux" }
                ],
                response_format: { type: "json_object" },
                temperature: 0.1
            })
        });

        const result = await response.json();

        if (result.error) {
            console.error('\n❌ ERROR API GROQ:');
            console.error(JSON.stringify(result, null, 2));
        } else {
            console.log('\n✅ ¡ÉXITO!');
            console.log('--- RESPUESTA ---');
            console.log(result.choices[0].message.content);
        }

    } catch (error) {
        console.error('\n💥 Error conexión:', error.message);
    }
}

testGroq();
