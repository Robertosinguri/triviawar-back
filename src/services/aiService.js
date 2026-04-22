// Configuración de APIs
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const COHERE_API_KEY = process.env.COHERE_API_KEY;
const HF_API_KEY = process.env.HF_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Configuración Estática de Modelos
const GEMINI_MODEL = "gemini-3.1-flash-lite-preview";
const GROQ_MODEL_LARGE = "llama-3.3-70b-versatile"; // Para niveles difíciles (Killer/Conocedor)
const GROQ_MODEL_SMALL = "llama-3.1-8b-instant"; // Para nivel fácil (Baby) - Ultra rápido
const COHERE_MODEL = "command-r-08-2024";
const HF_MODEL = "meta-llama/Llama-3.1-8B-Instruct";
const OPENROUTER_MODEL = "liquid/lfm-2.5-1.2b-thinking:free"; // Modelo único para OpenRouter
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const HF_URL = "https://router.huggingface.co/v1/chat/completions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const SYSTEM_INSTRUCTION = `Eres un Maestro de Trivia Profesional y un experto en taxonomía del conocimiento.
Tu única misión es generar un JSON puro que contenga preguntas de alta calidad.
- Formato: Array de objetos JSON.
- Por cada temática recibida, debes generar EXACTAMENTE 3 preguntas: 1 nivel "baby", 1 "conocedor" y 1 "killer".
- El JSON final debe contener la dificultad asignada para cada pregunta en el campo "dificultad" ('baby', 'conocedor' o 'killer').
- Regla de Respuesta: El campo "respuestaCorrecta" DEBE ser el índice exacto (0-3) de la opción correcta.
- Salida: ÚNICAMENTE el código JSON puro, sin explicaciones ni markdown.`;

// Helper para construir prompt completo con distribución de temas
const buildPrompt = (tematicas) => {
  const totalPreguntas = tematicas.length * 3;
  return `ACTÚA COMO UN MAESTRO DE TRIVIA PROFESIONAL.
GENERA EXACTAMENTE ${totalPreguntas} PREGUNTAS EN TOTAL sobre las siguientes temáticas: ${tematicas.join(", ")}.

REGLAS DE DOMINIO PARA ESTA SESIÓN:
Por CADA temática proporcionada, genera exactamente 3 preguntas siguiendo esta curva:
1. Una pregunta Nivel "baby": MUY FÁCIL, conceptos básicos.
2. Una pregunta Nivel "conocedor": INTERMEDIO, datos específicos.
3. Una pregunta Nivel "killer": EXPERTO TOTAL, denso, técnico y especializado.

FORMATO JSON OBLIGATORIO (Array de objetos):
[
  {
    "pregunta": "texto de la pregunta...",
    "opciones": ["...", "...", "...", "..."],
    "respuestaCorrecta": 0,
    "tematica": "categoría",
    "dificultad": "baby"
  }
]

REGLAS CRÍTICAS:
- El índice "respuestaCorrecta" (0-3) debe ser exacto.
- NO uses markdown (\`\`\`json).
- Cada temática debe tener exactamente sus 3 preguntas.`;
};

function initOpenRouter() {
  try {
    if (OPENROUTER_API_KEY) {
      console.log(
        "⚡ [PLAN D] OpenRouter inicializado (Modelo: liquid/lfm-2.5-1.2b-thinking:free)",
      );
    } else {
      console.warn(
        "⚠️ [AI] OPENROUTER_API_KEY no encontrada. OpenRouter desactivado.",
      );
    }
  } catch (error) {
    console.error("❌ Error inicializando OpenRouter:", error.message);
  }
}

initOpenRouter();

/**
 * PLAN E: OpenRouter (Última opción)
 */

const generateWithOpenRouter = async (tematicas) => {
  if (!OPENROUTER_API_KEY) {
    console.warn(
      "⚠️ [PLAN E] OpenRouter omitido: Falta OPENROUTER_API_KEY en .env",
    );
    return null;
  }
  console.log(
    "🚀 [PLAN E] Intentando generación con OpenRouter (liquid/lfm-2.5-1.2b-thinking:free)...",
  );

  const activeModel = OPENROUTER_MODEL; // Modelo único para OpenRouter
  const startTime = Date.now();
  const prompt = buildPrompt(tematicas);

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://triviawar.com", // Opcional pero recomendado
        "X-Title": "Trivia War", // Opcional pero recomendado
      },
      body: JSON.stringify({
        model: activeModel,
        messages: [
          { role: "system", content: SYSTEM_INSTRUCTION },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    const message = result.choices?.[0]?.message || {};
    const text = message.content || message.reasoning || '';
    if (!text)
      throw new Error(result.error?.message || "Respuesta vacía de OpenRouter");

    return {
      success: true,
      preguntas: normalizeQuestions(
        JSON.parse(cleanJsonResponse(text)),
        tematicas,
      ),
      aiUsada: `OpenRouter (liquid/lfm-2.5-1.2b-thinking:free)`,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    console.error("❌ Falló Plan E (OpenRouter):", error.message);
    return null;
  }
};

/**
 * PLAN A: Gemini (Principal - Ultra Rápido)
 */

const generateWithGemini = async (tematicas) => {
  if (!GEMINI_API_KEY) {
    console.warn("⚠️ [PLAN A] Gemini omitido: Falta GEMINI_API_KEY en .env");
    return null;
  }
  console.log(`🚀 [PLAN A] Intentando generación con Gemini (${GEMINI_MODEL})...`);
  const startTime = Date.now();
  const prompt = buildPrompt(tematicas);

  try {
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json",
        },
      }),
    });

    const result = await response.json();
    if (result.error) throw new Error(result.error.message || "Error en API de Gemini");

    const parts = result.candidates?.[0]?.content?.parts || [];
    const lastPart = parts[parts.length - 1] || {};
    const text = lastPart.text || parts[0]?.text || "";

    if (!text) throw new Error("Respuesta vacía de Gemini");

    return {
      success: true,
      preguntas: normalizeQuestions(JSON.parse(cleanJsonResponse(text)), tematicas),
      aiUsada: `Gemini (${GEMINI_MODEL})`,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    console.error("❌ Falló Plan A (Gemini):", error.message);
    return null;
  }
};

/**
 * PLAN B: Groq (Llama 3 70B) - Segunda opción
 */

const generateWithGroq = async (tematicas) => {
  if (!GROQ_API_KEY) {
    console.warn("⚠️ [PLAN B] Groq omitido: Falta GROQ_API_KEY en .env");
    return null;
  }

  // Ahora se generan todas las dificultades, usamos el modelo capaz de killer
  let activeModel = GROQ_MODEL_LARGE;
  let modelDescription = "70B (Mixto - Máxima calidad)";

  console.log(`🚀 [PLAN B] Intentando generación con Groq (${modelDescription})...`);

  const startTime = Date.now();
  const prompt = buildPrompt(tematicas);

  try {
    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: activeModel,
        messages: [
          { role: "system", content: SYSTEM_INSTRUCTION },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      }),
    });

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content || "";
    if (!text)
      throw new Error(result.error?.message || "Respuesta vacía de Groq");

    return {
      success: true,
      preguntas: normalizeQuestions(
        JSON.parse(cleanJsonResponse(text)),
        tematicas,
      ),
      aiUsada: `Groq (${activeModel}) - Estrategia: ${modelDescription}`,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    console.error("❌ Falló Plan B (Groq):", error.message);
    return null;
  }
};

/**
 * PLAN C: Cohere (Muy estable) - Tercera opción
 */

const generateWithCohere = async (tematicas) => {
  if (!COHERE_API_KEY) return null;
  console.log("🧡 [PLAN C] Intentando generación con Cohere...");
  const startTime = Date.now();
  const prompt = buildPrompt(tematicas);

  try {
    const response = await fetch("https://api.cohere.ai/v2/chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${COHERE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: COHERE_MODEL,
        messages: [
          { role: "system", content: SYSTEM_INSTRUCTION },
          { role: "user", content: prompt },
        ],
      }),
    });

    const result = await response.json();
    const text = result.message?.content?.[0]?.text || "";
    if (!text) throw new Error("Respuesta vacía de Cohere");

    return {
      success: true,
      preguntas: normalizeQuestions(
        JSON.parse(cleanJsonResponse(text)),
        tematicas,
      ),
      aiUsada: `Cohere`,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    console.error("❌ Falló Plan C (Cohere):", error.message);
    return null;
  }
};

/**
 * PLAN D: Hugging Face - Cuarta opción
 */

const generateWithHF = async (tematicas) => {
  if (!HF_API_KEY) return null;
  console.log("🔄 [PLAN D] Intentando generación con HF...");
  const startTime = Date.now();
  const prompt = buildPrompt(tematicas);

  try {
    const response = await fetch(HF_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: HF_MODEL,
        messages: [
          { role: "system", content: SYSTEM_INSTRUCTION },
          { role: "user", content: prompt },
        ],
        max_tokens: 1000,
        temperature: 0.5,
      }),
    });

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content || "";
    if (!text) throw new Error("Respuesta vacía de HF");

    return {
      success: true,
      preguntas: normalizeQuestions(
        JSON.parse(cleanJsonResponse(text)),
        tematicas,
      ),
      aiUsada: "HF Llama",
      duration: Date.now() - startTime,
    };
  } catch (error) {
    console.error("❌ Falló Plan D (HF):", error.message);
    return null;
  }
};

const normalizeQuestions = (preguntasRaw, tematicas) => {
  let data = preguntasRaw;

  // Si es un objeto que contiene el array bajo alguna clave típica
  if (!Array.isArray(data)) {
    const keys = ["preguntas", "questions", "items", "trivia", "data"];
    for (const key of keys) {
      if (data[key] && Array.isArray(data[key])) {
        data = data[key];
        break;
      }
    }
  }

  // Si sigue sin ser array, intentamos convertir objeto de objetos a array
  if (!Array.isArray(data) && typeof data === "object" && data !== null) {
    data = Object.values(data).filter((item) => typeof item === "object");
  }

  // Fallback final
  if (!Array.isArray(data)) {
    data = [data];
  }

  return data.map((p) => {
    // Normalización de propiedades para asegurar compatibilidad
    const opciones = p.opciones ||
      p.options ||
      p.choices || ["A", "B", "C", "D"];
    const correct =
      p.respuestaCorrecta ??
      p.answer ??
      p.correctIndex ??
      p.correct_answer ??
      0;

    return {
      pregunta: p.pregunta || p.question || "Pregunta sin texto",
      opciones: Array.isArray(opciones)
        ? opciones.slice(0, 4)
        : ["A", "B", "C", "D"],
      respuestaCorrecta: Number.isInteger(Number(correct))
        ? Number(correct) % 4
        : 0,
      tematica:
        p.tematica || p.category || p.topic || tematicas[0] || "General",
      dificultad: p.dificultad || 'conocedor'
    };
  });
};

const cleanJsonResponse = (text) => {
  if (!text) return "[]";
  // Eliminar etiquetas de markdown y espacios sobrantes
  let cleaned = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  // Si el texto contiene algo antes del primer '[' o después del último ']'
  const startIdx = cleaned.indexOf("[");
  const endIdx = cleaned.lastIndexOf("]");

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.substring(startIdx, endIdx + 1);
  }

  return cleaned;
};

const generateQuestions = async (tematicas) => {
  const startTime = Date.now();
  const prompt = buildPrompt(tematicas);

  console.log(`\n🎯 SOLICITUD DE GENERACIÓN DE PREGUNTAS`);
  console.log(`   📋 Temáticas: ${tematicas.join(', ')}`);
  console.log(`   🔄 Orden de prioridad (nueva estrategia):`);
  console.log(`      1. PLAN A: Gemini (3.1 Flash Lite - Principal)`);
  console.log(`      2. PLAN B: Groq (modelo inteligente por dificultad)`);
  console.log(`      3. PLAN C: Cohere (35B - equilibrio calidad/eficiencia)`);
  console.log(`      4. PLAN D: Hugging Face (8B - gratuito sólido)`);
  console.log(`      5. PLAN E: OpenRouter (1.2B - último recurso)`);

  // 1. Gemini (Plan A) - Principal
  console.log(`\n🔧 [PLAN A] Intentando Gemini (3.1 Flash Lite)...`);
  const geminiRes = await generateWithGemini(tematicas);
  if (geminiRes) {
    console.log(`✅ [PLAN A] Éxito con Gemini`);
    return geminiRes;
  }
  console.log(`❌ [PLAN A] Falló, procediendo al Plan B (Groq)...`);

  // 2. Groq (Plan B) - Segunda opción con lógica inteligente por dificultad
  console.log(`\n🔧 [PLAN B] Ejecutando estrategia inteligente (Groq)...`);
  const groqRes = await generateWithGroq(tematicas);
  if (groqRes) {
    console.log(`✅ [PLAN B] Éxito con Groq (${groqRes.aiUsada})`);
    return groqRes;
  }
  console.log(`❌ [PLAN B] Falló, procediendo al Plan C (Cohere)...`);

  // 3. Cohere (Plan C) - Tercera opción (equilibrio calidad/eficiencia)
  console.log(`\n🔧 [PLAN C] Intentando Cohere (35B)...`);
  const cohereRes = await generateWithCohere(tematicas);
  if (cohereRes) {
    console.log(`✅ [PLAN C] Éxito con Cohere`);
    return cohereRes;
  }
  console.log(`❌ [PLAN C] Falló, procediendo al Plan D (HF)...`);

  // 4. HF (Plan D) - Cuarta opción (gratuito sólido)
  console.log(`\n🔧 [PLAN D] Intentando Hugging Face (8B)...`);
  const hfRes = await generateWithHF(tematicas);
  if (hfRes) {
    console.log(`✅ [PLAN D] Éxito con Hugging Face`);
    return hfRes;
  }
  console.log(`❌ [PLAN D] Falló, procediendo al Plan E (OpenRouter)...`);

  // 5. OpenRouter (Plan E) - Última opción (último recurso)
  console.log(`\n🔧 [PLAN E] Intentando OpenRouter (1.2B free)...`);
  const openRouterRes = await generateWithOpenRouter(tematicas);
  if (openRouterRes) {
    console.log(`✅ [PLAN E] Éxito con OpenRouter`);
    return openRouterRes;
  }
  console.log(`❌ [PLAN E] Falló, todos los planes agotados`);

  return { 
    success: false, 
    message: "Todos los motores de IA fallaron.",
    duration: Date.now() - startTime
  };
};

module.exports = {
  generateQuestions,
};
