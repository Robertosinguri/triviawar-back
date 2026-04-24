// ============================================================
// CONFIGURACIÓN DE APIs
// ============================================================
const GEMINI_API_KEY    = process.env.GEMINI_API_KEY;
const GROQ_API_KEY      = process.env.GROQ_API_KEY;
const COHERE_API_KEY    = process.env.COHERE_API_KEY;
const HF_API_KEY        = process.env.HF_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Modelos
const GEMINI_MODEL      = "gemini-3.1-flash-lite-preview";
const GROQ_MODEL_LARGE  = "llama-3.3-70b-versatile";
const COHERE_MODEL      = "command-r-08-2024";
const HF_MODEL          = "meta-llama/Llama-3.1-8B-Instruct";
const OPENROUTER_MODEL  = "liquid/lfm-2.5-1.2b-thinking:free";

// URLs
const GEMINI_URL      = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
const GROQ_URL        = "https://api.groq.com/openai/v1/chat/completions";
const COHERE_URL      = "https://api.cohere.ai/v2/chat";
const HF_URL          = "https://router.huggingface.co/v1/chat/completions";
const OPENROUTER_URL  = "https://openrouter.ai/api/v1/chat/completions";

// Timeout para Gemini (ms) — si no responde en 8s, pasa al fallback
const GEMINI_TIMEOUT_MS = 8000;

// ============================================================
// TAXONOMÍA DE DIFICULTAD (Compartida entre motores)
// ============================================================

const DIFFICULTY_TAXONOMY = `
DEFINICIÓN ESTRICTA DE NIVELES:

🍼 NIVEL BABY:
  - Pregunta que CUALQUIER persona respondería, sin importar si conoce el tema.
  - Basada en hechos famosos, ampliamente conocidos por la cultura popular.
  - La respuesta correcta NO debe requerir ningún estudio previo.
  - Las opciones incorrectas son claramente equivocadas para alguien con sentido común.
  - Ejemplo válido: "¿Qué planeta es el más grande del sistema solar?" → Júpiter

🧠 NIVEL CONOCEDOR:
  - Pregunta que alguien con interés REAL en el tema respondería, pero no quien pasó por casualidad.
  - Requiere haber leído, estudiado o practicado el área con regularidad.
  - La respuesta no es obvia para alguien que no conoce el tema.
  - Las opciones incorrectas son plausibles para quien solo conoce lo básico.
  - Ejemplo válido: "¿En qué año se publicó el primer paper de redes neuronales convolucionales (CNN)?" → 1989 (LeCun)

💀 NIVEL KILLER:
  - Pregunta que SOLO un experto real, con años de experiencia en el campo, respondería.
  - Debe involucrar: datos técnicos precisos, fechas no obvias, terminología especializada, o relaciones causales complejas entre conceptos.
  - Un "conocedor" del tema debería dudar entre las opciones, que deben ser TODAS plausibles.
  - NUNCA se puede responder por eliminación ni intuición.
  - NUNCA es una pregunta que un no-experto resolvería aunque "sepa algo" del área.
  - Ejemplo válido: "¿Cuál es el valor exacto del hiperparámetro de momentum utilizado por Sutskever et al. en el paper de SGD de 2013 que superó a Adam en ciertos benchmarks de NLP?" → 0.9`;

// ============================================================
// INSTRUCCIONES DE SISTEMA (AISLADAS POR MOTOR)
// ============================================================

const SYSTEM_INSTRUCTION_COMPETITIVE = `Eres un Maestro de Trivia Profesional con una taxonomía de dificultad muy estricta.
Tu única misión es generar preguntas en formato JSON puro, de altísima calidad y con los niveles de dificultad EXACTOS.
${DIFFICULTY_TAXONOMY}

REGLAS DE FORMATO:
- Salida: ÚNICAMENTE el array JSON, sin texto adicional, sin markdown, sin explicaciones.
- Campo "dificultad": exactamente 'baby', 'conocedor' o 'killer'.
- Campo "respuestaCorrecta": el índice exacto (0-3) de la opción correcta dentro del array "opciones".`;

const SYSTEM_INSTRUCTION_TRAINING = `Eres un Entrenador de Trivia Especializado con criterio de dificultad muy preciso.
Tu misión: generar un desafío de entrenamiento de EXACTAMENTE 5 preguntas.
${DIFFICULTY_TAXONOMY}

REGLAS ABSOLUTAS:
- Genera EXACTAMENTE 5 preguntas. Ni más, ni menos.
- TODAS las preguntas deben ser del nivel de dificultad solicitado.
- Salida: ÚNICAMENTE el array JSON puro. Sin texto adicional.
- Campo "respuestaCorrecta": el índice exacto (0-3).`;

// ============================================================
// HELPERS DE PROMPT
// ============================================================

const buildCompetitivePrompt = (tematicas) => {
  const totalPreguntas = tematicas.length * 3;
  return `GENERA EXACTAMENTE ${totalPreguntas} PREGUNTAS de trivia.

TEMÁTICAS: ${tematicas.join(", ")}

Por cada temática, genera EXACTAMENTE 3 preguntas:
  - 1 pregunta nivel "baby" (sigue la definición estricta del sistema)
  - 1 pregunta nivel "conocedor" (sigue la definición estricta del sistema)
  - 1 pregunta nivel "killer" (sigue la definición estricta del sistema)

FORMATO JSON OBLIGATORIO:
[
  {
    "pregunta": "texto de la pregunta",
    "opciones": ["opción A", "opción B", "opción C", "opción D"],
    "respuestaCorrecta": 0,
    "tematica": "nombre del tema",
    "dificultad": "baby"
  }
]

CRÍTICO: Responde SOLO con el array JSON. Sin explicaciones.`;
};

const buildTrainingPrompt = (tematica, dificultad, count = 5) => {
  const levelEmoji = dificultad === 'baby' ? '🍼' : dificultad === 'conocedor' ? '🧠' : '💀';
  return `GENERA EXACTAMENTE ${count} PREGUNTAS de entrenamiento.

TEMA: "${tematica}"
NIVEL OBLIGATORIO: "${dificultad}" ${levelEmoji}
CANTIDAD EXACTA: ${count} preguntas — no más, no menos.

Todas las preguntas DEBEN cumplir la definición estricta del nivel "${dificultad}".

FORMATO JSON:
[
  {
    "pregunta": "texto de la pregunta",
    "opciones": ["opción A", "opción B", "opción C", "opción D"],
    "respuestaCorrecta": 0,
    "tematica": "${tematica}",
    "dificultad": "${dificultad}"
  }
]

CRÍTICO: Responde SOLO con el array JSON. Sin texto adicional.`;
};

// Temperatura diferenciada por nivel de dificultad
const getTempByDifficulty = (dificultad) => {
  if (dificultad === 'baby')      return 0.4; // Precisión factual
  if (dificultad === 'conocedor') return 0.7; // Equilibrio
  if (dificultad === 'killer')    return 0.95; // Creatividad máxima para datos oscuros
  return 0.7; // Default
};

// ============================================================
// UTILIDADES COMPARTIDAS
// ============================================================

/**
 * Crea un fetch con timeout usando AbortController.
 * Si la IA no responde en `timeoutMs`, lanza AbortError.
 */
const fetchWithTimeout = async (url, options, timeoutMs = 15000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`TIMEOUT: La IA no respondió en ${timeoutMs / 1000}s`);
    }
    throw err;
  }
};

const normalizeQuestions = (preguntasRaw, tematicas) => {
  let data = preguntasRaw;
  if (!Array.isArray(data)) {
    const keys = ["preguntas", "questions", "items", "trivia", "data"];
    for (const key of keys) {
      if (data[key] && Array.isArray(data[key])) { data = data[key]; break; }
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

const logAIResult = (planName, aiName, success, duration, count = null) => {
  const status = success ? '✅' : '❌';
  const countInfo = count !== null ? ` | ${count} preguntas` : '';
  console.log(`${status} [${planName}] ${aiName} → ${duration}ms${countInfo}`);
};

// ============================================================
// GENERADORES INDIVIDUALES (Con Timeout)
// ============================================================

const tryGemini = async (sysInstruction, prompt, temperature = 0.7) => {
  const start = Date.now();
  const body = JSON.stringify({
    system_instruction: { parts: [{ text: sysInstruction }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature, responseMimeType: "application/json" }
  });
  const response = await fetchWithTimeout(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body
  }, GEMINI_TIMEOUT_MS);
  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text || result.error) throw new Error(result.error?.message || "Sin respuesta de Gemini");
  return { text, duration: Date.now() - start };
};

const tryGroq = async (sysInstruction, prompt, temperature = 0.7) => {
  const start = Date.now();
  const response = await fetchWithTimeout(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL_LARGE,
      messages: [{ role: "system", content: sysInstruction }, { role: "user", content: prompt }],
      temperature
    })
  }, 15000);
  const result = await response.json();
  const text = result.choices?.[0]?.message?.content;
  if (!text) throw new Error("Sin respuesta de Groq");
  return { text, duration: Date.now() - start };
};

const tryCohere = async (sysInstruction, prompt, temperature = 0.7) => {
  if (!COHERE_API_KEY) throw new Error("Sin COHERE_API_KEY");
  const start = Date.now();
  const response = await fetchWithTimeout(COHERE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${COHERE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: COHERE_MODEL,
      messages: [{ role: "system", content: sysInstruction }, { role: "user", content: prompt }],
      temperature
    })
  }, 15000);
  const result = await response.json();
  const text = result.message?.content?.[0]?.text;
  if (!text) throw new Error("Sin respuesta de Cohere");
  return { text, duration: Date.now() - start };
};

const tryHF = async (sysInstruction, prompt) => {
  if (!HF_API_KEY) throw new Error("Sin HF_API_KEY");
  const start = Date.now();
  const response = await fetchWithTimeout(HF_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${HF_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: HF_MODEL,
      messages: [{ role: "system", content: sysInstruction }, { role: "user", content: prompt }],
      max_tokens: 1500,
      temperature: 0.7
    })
  }, 20000);
  const result = await response.json();
  const text = result.choices?.[0]?.message?.content;
  if (!text) throw new Error("Sin respuesta de HF");
  return { text, duration: Date.now() - start };
};

const tryOpenRouter = async (sysInstruction, prompt) => {
  if (!OPENROUTER_API_KEY) throw new Error("Sin OPENROUTER_API_KEY");
  const start = Date.now();
  const response = await fetchWithTimeout(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://triviawar.app",
      "X-Title": "TriviaWar"
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [{ role: "system", content: sysInstruction }, { role: "user", content: prompt }],
      temperature: 0.7
    })
  }, 25000);
  const result = await response.json();
  const text = result.choices?.[0]?.message?.content;
  if (!text) throw new Error("Sin respuesta de OpenRouter");
  return { text, duration: Date.now() - start };
};

// ============================================================
// ORQUESTADOR GENÉRICO DE FALLBACKS
// ============================================================

/**
 * Ejecuta los planes A→E en secuencia hasta obtener una respuesta válida.
 * @param {string} sysInstruction - Instrucción del sistema para esta sesión
 * @param {string} prompt - Prompt del usuario
 * @param {string[]} tematicas - Para normalizar preguntas
 * @param {number} temperature - Temperatura base (puede ser sobreescrita por nivel)
 * @param {number|null} expectedCount - Si se especifica, valida la cantidad de preguntas
 */
const runWithFallbacks = async (sysInstruction, prompt, tematicas, temperature = 0.7, expectedCount = null) => {
  const totalStart = Date.now();
  const plans = [
    { name: "Plan A", label: `Gemini (${GEMINI_MODEL})`, fn: () => tryGemini(sysInstruction, prompt, temperature) },
    { name: "Plan B", label: "Groq (Llama 3 70B)", fn: () => tryGroq(sysInstruction, prompt, temperature) },
    { name: "Plan C", label: "Cohere (Command R)", fn: () => tryCohere(sysInstruction, prompt, temperature) },
    { name: "Plan D", label: "Hugging Face (Llama 8B)", fn: () => tryHF(sysInstruction, prompt) },
    { name: "Plan E", label: "OpenRouter (LFM)", fn: () => tryOpenRouter(sysInstruction, prompt) },
  ];

  for (const plan of plans) {
    try {
      console.log(`🔄 [${plan.name}] Intentando con ${plan.label}...`);
      const { text, duration } = await plan.fn();
      const parsed = JSON.parse(cleanJsonResponse(text));
      const preguntas = normalizeQuestions(parsed, tematicas);

      // Validación de conteo si se especificó
      if (expectedCount && preguntas.length !== expectedCount) {
        console.warn(`⚠️ [${plan.name}] Se esperaban ${expectedCount} preguntas, se recibieron ${preguntas.length}. Intentando siguiente...`);
        continue;
      }

      logAIResult(plan.name, plan.label, true, duration, preguntas.length);
      return {
        success: true,
        preguntas,
        aiUsada: plan.label,
        duration: Date.now() - totalStart
      };
    } catch (err) {
      console.error(`❌ [${plan.name}] ${err.message}`);
    }
  }

  return { success: false, message: "Todos los motores de IA fallaron." };
};

// ============================================================
// MOTOR COMPETITIVO
// ============================================================

const generateQuestions = async (tematicas) => {
  const totalPreguntas = tematicas.length * 3;
  const prompt = buildCompetitivePrompt(tematicas);

  console.log(`\n🎮 MODO COMPETITIVO`);
  console.log(`   Temáticas: ${tematicas.join(', ')} → ${totalPreguntas} preguntas esperadas`);

  // Temperatura mixta: usamos 0.7 como base (mezcla de los 3 niveles)
  return runWithFallbacks(
    SYSTEM_INSTRUCTION_COMPETITIVE,
    prompt,
    tematicas,
    0.7,
    totalPreguntas
  );
};

// ============================================================
// MOTOR DE ENTRENAMIENTO (EXCLUSIVO)
// ============================================================

const generateTrainingQuestions = async (tematica, dificultad, count = 5) => {
  const prompt = buildTrainingPrompt(tematica, dificultad, count);
  const temperature = getTempByDifficulty(dificultad);

  console.log(`\n****************************************************`);
  console.log(`🏋️  MOTOR DE ENTRENAMIENTO EXCLUSIVO`);
  console.log(`   Tema: ${tematica} | Nivel: ${dificultad} | Cantidad: ${count} | Temp: ${temperature}`);
  console.log(`****************************************************\n`);

  return runWithFallbacks(
    SYSTEM_INSTRUCTION_TRAINING,
    prompt,
    [tematica],
    temperature,
    count
  );
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  generateQuestions,
  generateTrainingQuestions
};
