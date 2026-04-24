// Configuración de APIs
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;
const HF_API_KEY = process.env.HF_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Configuración Estática de Modelos
const GEMINI_MODEL = "gemini-3.1-flash-lite-preview";
const GROQ_MODEL_LARGE = "llama-3.3-70b-versatile"; 
const GROQ_MODEL_SMALL = "llama-3.1-8b-instant"; 
const COHERE_MODEL = "command-r-08-2024";
const HF_MODEL = "meta-llama/Llama-3.1-8B-Instruct";
const OPENROUTER_MODEL = "liquid/lfm-2.5-1.2b-thinking:free"; 
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const HF_URL = "https://router.huggingface.co/v1/chat/completions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// ============================================================
// INSTRUCCIONES DE SISTEMA (AISLADAS)
// ============================================================

const SYSTEM_INSTRUCTION_COMPETITIVE = `Eres un Maestro de Trivia Profesional y un experto en taxonomía del conocimiento.
Tu única misión es generar un JSON puro que contenga preguntas de alta calidad.
- Formato: Array de objetos JSON.
- Por cada temática recibida, debes generar EXACTAMENTE 3 preguntas: 1 nivel "baby", 1 "conocedor" y 1 "killer".
- El JSON final debe contener la dificultad asignada para cada pregunta en el campo "dificultad" ('baby', 'conocedor' o 'killer').
- Regla de Respuesta: El campo "respuestaCorrecta" DEBE ser el índice exacto (0-3) de la opción correcta.
- Salida: ÚNICAMENTE el código JSON puro, sin explicaciones ni markdown.`;

const SYSTEM_INSTRUCTION_TRAINING = `Eres un Entrenador de Trivia Especializado.
Tu misión es generar un desafío de entrenamiento de exactamente 5 preguntas sobre un tema específico.
- Generar EXACTAMENTE 5 preguntas. Ni más, ni menos.
- Todas las preguntas deben ser del nivel de dificultad solicitado.
- Formato: Array de objetos JSON puro.
- El campo "respuestaCorrecta" es el índice (0-3).
- Salida: Solo JSON, sin texto adicional.`;

// ============================================================
// HELPERS DE PROMPT
// ============================================================

const buildCompetitivePrompt = (tematicas) => {
  const totalPreguntas = tematicas.length * 3;
  return `ACTÚA COMO UN MAESTRO DE TRIVIA PROFESIONAL.
GENERA EXACTAMENTE ${totalPreguntas} PREGUNTAS EN TOTAL sobre las siguientes temáticas: ${tematicas.join(", ")}.
Genera 3 preguntas por cada tema: una baby, una conocedor y una killer.`;
};

const buildTrainingPrompt = (tematica, dificultad, count = 5) => {
  return `### ATENCIÓN: GENERACIÓN DE ENTRENAMIENTO SOLITARIO ###
TEMA: "${tematica}"
DIFICULTAD FIJA: "${dificultad}"
CANTIDAD OBLIGATORIA: ${count} PREGUNTAS.

INSTRUCCIONES PARA LA IA:
1. Genera EXACTAMENTE ${count} preguntas. No 3, ni 6. SOLO ${count}.
2. Todas deben ser de la dificultad "${dificultad}".
3. Ignora cualquier regla anterior de rondas o progresión de dificultad.
4. Responde ÚNICAMENTE con el array JSON de ${count} objetos.

FORMATO JSON ESPERADO:
[
  {
    "pregunta": "...",
    "opciones": ["...", "...", "...", "..."],
    "respuestaCorrecta": 0,
    "tematica": "${tematica}",
    "dificultad": "${dificultad}"
  }
]`;
};

// ============================================================
// SERVICIOS COMPARTIDOS
// ============================================================

const normalizeQuestions = (preguntasRaw, tematicas) => {
  let data = preguntasRaw;
  if (!Array.isArray(data)) {
    const keys = ["preguntas", "questions", "items", "trivia", "data"];
    for (const key of keys) {
      if (data[key] && Array.isArray(data[key])) {
        data = data[key];
        break;
      }
    }
  }
  if (!Array.isArray(data) && typeof data === "object" && data !== null) {
    data = Object.values(data).filter((item) => typeof item === "object");
  }
  if (!Array.isArray(data)) data = [data];

  return data.map((p) => {
    const opciones = p.opciones || p.options || p.choices || ["A", "B", "C", "D"];
    const correct = p.respuestaCorrecta ?? p.answer ?? p.correctIndex ?? 0;
    return {
      pregunta: p.pregunta || p.question || "Pregunta sin texto",
      opciones: Array.isArray(opciones) ? opciones.slice(0, 4) : ["A", "B", "C", "D"],
      respuestaCorrecta: Number.isInteger(Number(correct)) ? Number(correct) % 4 : 0,
      tematica: p.tematica || p.category || p.topic || tematicas[0] || "General",
      dificultad: p.dificultad || 'conocedor'
    };
  });
};

const cleanJsonResponse = (text) => {
  if (!text) return "[]";
  let cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
  const startIdx = cleaned.indexOf("[");
  const endIdx = cleaned.lastIndexOf("]");
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.substring(startIdx, endIdx + 1);
  }
  return cleaned;
};

// ============================================================
// MOTOR COMPETITIVO (RESTAURADO)
// ============================================================

const generateQuestions = async (tematicas) => {
  const startTime = Date.now();
  const prompt = buildCompetitivePrompt(tematicas);
  const sysInst = SYSTEM_INSTRUCTION_COMPETITIVE;

  console.log(`\n🎯 MODO COMPETITIVO: Generando 3 preguntas por tema...`);

  // Intento Gemini
  try {
    const response = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: sysInst }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, responseMimeType: "application/json" }
        })
      });
      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return {
        success: true,
        preguntas: normalizeQuestions(JSON.parse(cleanJsonResponse(text)), tematicas),
        aiUsada: `Gemini Competitive`,
        duration: Date.now() - startTime
      };
  } catch (e) { console.error("Plan A Falló"); }

  // Fallback Groq
  try {
    const response = await fetch(GROQ_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: GROQ_MODEL_LARGE,
          messages: [{ role: "system", content: sysInst }, { role: "user", content: prompt }],
          temperature: 0.7
        })
      });
      const result = await response.json();
      const text = result.choices[0].message.content;
      return {
        success: true,
        preguntas: normalizeQuestions(JSON.parse(cleanJsonResponse(text)), tematicas),
        aiUsada: `Groq Competitive`,
        duration: Date.now() - startTime
      };
  } catch (e) { return { success: false, message: "Error en motor competitivo" }; }
};

// ============================================================
// MOTOR ENTRENAMIENTO (NUEVO E INDEPENDIENTE)
// ============================================================

const generateTrainingQuestions = async (tematica, dificultad, count = 5) => {
  const startTime = Date.now();
  const prompt = buildTrainingPrompt(tematica, dificultad, count);
  const sysInst = SYSTEM_INSTRUCTION_TRAINING;

  console.log(`\n****************************************************`);
  console.log(`🏋️  ¡DISPARANDO MOTOR DE ENTRENAMIENTO EXCLUSIVO!`);
  console.log(`   📋 Tema: ${tematica} | Dificultad: ${dificultad} | Cantidad: ${count}`);
  console.log(`****************************************************\n`);

  // Intento Gemini (Entrenamiento)
  try {
    const response = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: sysInst }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, responseMimeType: "application/json" }
        })
      });
      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return {
        success: true,
        preguntas: normalizeQuestions(JSON.parse(cleanJsonResponse(text)), [tematica]),
        aiUsada: `Gemini Training`,
        duration: Date.now() - startTime
      };
  } catch (e) { console.error("Plan Training A Falló"); }

  // Fallback Groq (Entrenamiento)
  try {
    const response = await fetch(GROQ_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: GROQ_MODEL_LARGE,
          messages: [{ role: "system", content: sysInst }, { role: "user", content: prompt }],
          temperature: 0.7
        })
      });
      const result = await response.json();
      const text = result.choices[0].message.content;
      return {
        success: true,
        preguntas: normalizeQuestions(JSON.parse(cleanJsonResponse(text)), [tematica]),
        aiUsada: `Groq Training`,
        duration: Date.now() - startTime
      };
  } catch (e) { return { success: false, message: "Error en motor entrenamiento" }; }
};

module.exports = {
  generateQuestions,
  generateTrainingQuestions
};
