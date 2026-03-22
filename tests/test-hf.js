require('dotenv').config();

const HF_API_KEY = process.env.HF_API_KEY;
// URL tipo OpenAI para el Router de Hugging Face
const URL = "https://router.huggingface.co/v1/chat/completions";

async function testHF() {
    console.log('🧪 Probando Plan C (Hugging Face) via Chat Completions API...');

    try {
        const response = await fetch(URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${HF_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "meta-llama/Llama-3.1-8B-Instruct",
                messages: [
                    {
                        role: "system",
                        content: "Eres un generador de trivia. Responde solo con un array JSON de 2 preguntas sobre Astronomía. Formato: [{\"pregunta\": \"\", \"opciones\": [], \"answer\": 0, \"category\": \"\"}]"
                    },
                    {
                        role: "user",
                        content: "Genera las preguntas."
                    }
                ],
                max_tokens: 500,
                temperature: 0.7
            })
        });

        const result = await response.json();

        if (result.error) {
            console.error('\n❌ ERROR:');
            console.error(JSON.stringify(result, null, 2));
        } else {
            console.log('\n✅ ¡ÉXITO!');
            console.log('--- RESPUESTA ---');
            console.log(result.choices[0].message.content);
        }
    } catch (error) {
        console.error('\n💥 Error de conexión:', error.message);
    }
}

testHF();

