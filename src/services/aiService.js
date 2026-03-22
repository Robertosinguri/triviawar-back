const { GoogleGenerativeAI } = require('@google/generative-ai');

// Configuración de APIs
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;
const HF_API_KEY = process.env.HF_API_KEY;

// Configuración Estática de Modelos
const GROQ_MODEL_LARGE = "llama-3.3-70b-versatile"; // Para niveles difíciles (Killer/Conocedor)
const GROQ_MODEL_SMALL = "llama-3.1-8b-instant";    // Para nivel fácil (Baby) - Ultra rápido
const COHERE_MODEL = "command-r-08-2024";
const HF_MODEL = "meta-llama/Llama-3.1-8B-Instruct";
const HF_URL = "https://router.huggingface.co/v1/chat/completions";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

let genAI;
let model;

const SYSTEM_INSTRUCTION = `Eres un Maestro de Trivia Profesional y un experto en taxonomía del conocimiento. 
Tu única misión es generar un JSON que contenga exactamente 5 preguntas de alta calidad.
- Formato: Array de objetos JSON.
- Nivel de dificultad: Debes ser EXTREMADAMENTE estricto con el nivel solicitado (Baby, Conocedor o Killer).
- Regla de Respuesta: El campo "respuestaCorrecta" DEBE ser el índice exacto (0-3) de la opción correcta.
- Salida: ÚNICAMENTE el código JSON puro, sin explicaciones ni markdown.`;

// Helper para construir prompt completo con distribución de temas
const buildPrompt = (tematicas, dificultad) => {
    const nivelConfig = {
        'baby': {
            desc: 'MUY FÁCIL (Nivel Principiante)',
            persona: 'un profesor de primaria amable',
            guia: 'Usa lenguaje simple, conceptos básicos y cultura general masiva. Las opciones deben ser muy fáciles de descartar.'
        },
        'conocedor': {
            desc: 'INTERMEDIO (Nivel Aficionado)',
            persona: 'un entusiasta avanzado o estudiante universitario',
            guia: 'Usa términos que requieran haber estudiado o trabajado en el tema. Datos que no sabe el público general.'
        },
        'killer': {
            desc: 'Nivel EXPERTO TOTAL (Nivel Principal Engineer / CTO)',
            persona: 'un arquitecto de sistemas implacable y experto senior en la materia',
            guia: 'CRÍTICO: Si un estudiante o un senior promedio puede responder esto en menos de 10 segundos, HAS FALLADO. Prohibido usar nombres de ataques o conceptos conocidos en el enunciado. Describe la falla de implementación, la colisión de protocolos, el comportamiento de memoria o los logs de error. Sé denso, técnico y especializado. No expliques qué son las cosas.'
        }
    };

    const config = nivelConfig[dificultad] || nivelConfig['conocedor'];

    const distribucion = tematicas.map((tema, i) => {
        const base = Math.floor(5 / tematicas.length);
        const extra = i < (5 % tematicas.length) ? 1 : 0;
        return `${base + extra} de "${tema}"`;
    }).join(', ');

    return `ACTÚA COMO ${config.persona.toUpperCase()}.
GENERA 5 PREGUNTAS EN NIVEL ${config.desc} sobre: ${tematicas.join(', ')}.

REGLAS DE DOMINIO PARA ESTA SESIÓN:
- DISTRIBUCIÓN: ${distribucion}
- RIGOR: ${config.guia}

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
};

function initModel() {
    try {
        if (GEMINI_API_KEY) {
            genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
            model = genAI.getGenerativeModel({
                model: 'gemini-2.0-flash',
                systemInstruction: SYSTEM_INSTRUCTION
            });
            console.log('⚡ [PLAN A] Gemini 2.0 Flash inicializado');
        } else {
            console.warn('⚠️ [AI] GEMINI_API_KEY no encontrada. Gemini desactivado.');
        }
    } catch (error) {
        console.error('❌ Error inicializando Gemini:', error.message);
    }
}

initModel();

/**
 * PLAN B: Groq (Llama 3 70B - Ultra Rápido)
*/

const generateWithGroq = async (tematicas, dificultad) => {
    if (!GROQ_API_KEY) {
        console.warn('⚠️ [PLAN B] Groq omitido: Falta GROQ_API_KEY en .env');
        return null;
    }
    console.log('🚀 [PLAN B] Intentando generación con Groq...');

    const activeModel = (dificultad === 'baby') ? GROQ_MODEL_SMALL : GROQ_MODEL_LARGE;
    const startTime = Date.now();
    const prompt = buildPrompt(tematicas, dificultad);

    try {
        const response = await fetch(GROQ_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: activeModel,
                messages: [
                    { role: "system", content: SYSTEM_INSTRUCTION },
                    { role: "user", content: prompt }
                ],
                temperature: 0.7 // Subido para recuperar variedad en Killer
            })
        });

        const result = await response.json();
        const text = result.choices?.[0]?.message?.content || "";
        if (!text) throw new Error(result.error?.message || "Respuesta vacía de Groq");

        return {
            success: true,
            preguntas: normalizeQuestions(JSON.parse(cleanJsonResponse(text)), tematicas),
            aiUsada: `Groq (${activeModel})`,
            duration: Date.now() - startTime
        };
    } catch (error) {
        console.error('❌ Falló Plan B (Groq):', error.message);
        return null;
    }
};

/**
 * PLAN C: Cohere (Muy estable)
*/

const generateWithCohere = async (tematicas, dificultad) => {
    if (!COHERE_API_KEY) return null;
    console.log('🧡 [PLAN C] Intentando generación con Cohere...');
    const startTime = Date.now();
    const prompt = buildPrompt(tematicas, dificultad);

    try {
        const response = await fetch("https://api.cohere.ai/v2/chat", {
            method: "POST",
            headers: { "Authorization": `Bearer ${COHERE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: COHERE_MODEL,
                messages: [
                    { role: "system", content: SYSTEM_INSTRUCTION },
                    { role: "user", content: prompt }
                ]
            })
        });

        const result = await response.json();
        const text = result.message?.content?.[0]?.text || "";
        if (!text) throw new Error("Respuesta vacía de Cohere");

        return {
            success: true,
            preguntas: normalizeQuestions(JSON.parse(cleanJsonResponse(text)), tematicas),
            aiUsada: `Cohere`,
            duration: Date.now() - startTime
        };
    } catch (error) {
        console.error('❌ Falló Plan C (Cohere):', error.message);
        return null;
    }
};

/**
 * PLAN D: Hugging Face
*/

const generateWithHF = async (tematicas, dificultad) => {
    if (!HF_API_KEY) return null;
    console.log('🔄 [PLAN D] Intentando generación con HF...');
    const startTime = Date.now();
    const prompt = buildPrompt(tematicas, dificultad);

    try {
        const response = await fetch(HF_URL, {
            method: "POST",
            headers: { "Authorization": `Bearer ${HF_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: HF_MODEL,
                messages: [
                    { role: "system", content: SYSTEM_INSTRUCTION },
                    { role: "user", content: prompt }
                ],
                max_tokens: 1000,
                temperature: 0.5
            })
        });

        const result = await response.json();
        const text = result.choices?.[0]?.message?.content || "";
        if (!text) throw new Error("Respuesta vacía de HF");

        return {
            success: true,
            preguntas: normalizeQuestions(JSON.parse(cleanJsonResponse(text)), tematicas),
            aiUsada: 'HF Llama',
            duration: Date.now() - startTime
        };
    } catch (error) {
        console.error('❌ Falló Plan D (HF):', error.message);
        return null;
    }
};

const normalizeQuestions = (preguntasRaw, tematicas) => {
    let data = preguntasRaw;

    // Si es un objeto que contiene el array bajo alguna clave típica
    if (!Array.isArray(data)) {
        const keys = ['preguntas', 'questions', 'items', 'trivia', 'data'];
        for (const key of keys) {
            if (data[key] && Array.isArray(data[key])) {
                data = data[key];
                break;
            }
        }
    }

    // Si sigue sin ser array, intentamos convertir objeto de objetos a array
    if (!Array.isArray(data) && typeof data === 'object' && data !== null) {
        data = Object.values(data).filter(item => typeof item === 'object');
    }

    // Fallback final
    if (!Array.isArray(data)) {
        data = [data];
    }

    return data.slice(0, 5).map(p => {
        // Normalización de propiedades para asegurar compatibilidad
        const opciones = p.opciones || p.options || p.choices || ["A", "B", "C", "D"];
        const correct = p.respuestaCorrecta ?? p.answer ?? p.correctIndex ?? p.correct_answer ?? 0;

        return {
            pregunta: p.pregunta || p.question || "Pregunta sin texto",
            opciones: Array.isArray(opciones) ? opciones.slice(0, 4) : ["A", "B", "C", "D"],
            respuestaCorrecta: Number.isInteger(Number(correct)) ? Number(correct) % 4 : 0,
            tematica: p.tematica || p.category || p.topic || tematicas[0] || "General"
        };
    });
};

const cleanJsonResponse = (text) => {
    if (!text) return "[]";
    // Eliminar etiquetas de markdown y espacios sobrantes
    let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();

    // Si el texto contiene algo antes del primer '[' o después del último ']'
    const startIdx = cleaned.indexOf('[');
    const endIdx = cleaned.lastIndexOf(']');

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        cleaned = cleaned.substring(startIdx, endIdx + 1);
    }

    return cleaned;
};

const generateQuestions = async (tematicas, dificultad) => {
    const startTime = Date.now();
    const prompt = buildPrompt(tematicas, dificultad);

    // 1. Gemini (Plan A)
    try {
        if (model) {
            console.log(`⚡ Generando (Gemini 2.0 Flash): ${tematicas.join(', ')}...`);
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout Gemini")), 15000));
            const geminiRequest = model.generateContent(prompt);

            const result = await Promise.race([geminiRequest, timeout]);
            const text = result.response.text();

            return {
                success: true,
                preguntas: normalizeQuestions(JSON.parse(cleanJsonResponse(text)), tematicas),
                aiUsada: 'Gemini',
                duration: Date.now() - startTime
            };
        }
    } catch (error) {
        console.error(`❌ Error Gemini: ${error.message}. Saltando a Plan B...`);
    }

    // 2. Groq (Plan B)
    const groqRes = await generateWithGroq(tematicas, dificultad);
    if (groqRes) return groqRes;

    // 3. Cohere (Plan C)
    const cohereRes = await generateWithCohere(tematicas, dificultad);
    if (cohereRes) return cohereRes;

    // 4. HF (Plan D)
    const hfRes = await generateWithHF(tematicas, dificultad);
    if (hfRes) return hfRes;

    return { success: false, message: 'Todos los motores de IA fallaron.' };
};

module.exports = {
    generateQuestions
};
