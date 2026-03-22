require('dotenv').config();

const COHERE_API_KEY = process.env.COHERE_API_KEY;
const API_URL = "https://api.cohere.ai/v2/chat"; // Usando la v2 que es más robusta para JSON

async function testCohere() {
    console.log('🧪 Probando Cohere (Command R)...');

    if (!COHERE_API_KEY) {
        console.error('❌ Error: COHERE_API_KEY no encontrada en .env');
        return;
    }

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${COHERE_API_KEY}`,
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                model: "command-r-08-2024",
                messages: [
                    {
                        role: "system",
                        content: "Eres un experto generador de trivia. Tu objetivo es crear cuestionarios educativos y divertidos. Responde UNICAMENTE con un array JSON de 2 preguntas sobre 'Música'. Formato: [{\"pregunta\": \"\", \"opciones\": [\"\", \"\", \"\", \"\"], \"answer\": 0, \"category\": \"\"}]"
                    },
                    {
                        role: "user",
                        content: "Genera 2 preguntas nivel 'Conocedor'."
                    }
                ],
                response_format: { type: "json_object" }
            })
        });

        const result = await response.json();

        if (result.error || (!result.message && !result.text)) {
            console.error('\n❌ ERROR de la API de Cohere:');
            console.error(JSON.stringify(result, null, 2));
        } else {
            console.log('\n✅ ¡RESPUESTA RECIBIDA!');
            // console.log(JSON.stringify(result, null, 2));

            // En v2 la respuesta suele estar en message.content
            const content = result.message?.content?.[0]?.text || result.text || "";
            if (content) {
                console.log(content);
                try {
                    const json = JSON.parse(content);
                    console.log('\n⭐ JSON PARSEADO CON ÉXITO:');
                    console.log(JSON.stringify(json, null, 2));
                } catch (e) {
                    console.warn('\n⚠️ El texto no es un JSON puro, requiere limpieza.');
                }
            } else {
                console.log('No se recibió texto en la respuesta.');
                console.log(JSON.stringify(result, null, 2));
            }
        }
    } catch (error) {
        console.error('\n💥 ERROR EJECUTANDO LA PRUEBA:');
        console.error(error.message);
    }
}

testCohere();

