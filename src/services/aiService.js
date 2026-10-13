const { registrarInvalida } = require('../utils/iaAuditoria');

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
const GROQ_MODEL_LARGE  = "qwen/qwen3.8-27b";
const COHERE_MODEL      = "command-r-08-2024";
const HF_MODEL          = "meta-llama/Llama-3.1-8B-Instruct";
const OPENROUTER_MODEL  = "liquid/lfm-2.5-2.6b:free";

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
- Campo "respuestaCorrecta": el índice exacto (0-3) de la opción correcta dentro del array "opciones".
- Campo "respuestaCorrectaTexto": el texto EXACTO de esa misma opción, copiado carácter por carácter desde "opciones". DEBE coincidir siempre con "opciones[respuestaCorrecta]".
- Varía la posición de la respuesta correcta entre las 4 opciones: NO pongas siempre la correcta en la primera posición.`;

const SYSTEM_INSTRUCTION_TRAINING = `Eres un Entrenador de Trivia Especializado con criterio de dificultad muy preciso.
Tu misión: generar un desafío de entrenamiento de EXACTAMENTE 5 preguntas.
${DIFFICULTY_TAXONOMY}

REGLAS ABSOLUTAS:
- Genera EXACTAMENTE 5 preguntas. Ni más, ni menos.
- TODAS las preguntas deben ser del nivel de dificultad solicitado.
- Salida: ÚNICAMENTE el array JSON puro. Sin texto adicional.
- Campo "respuestaCorrecta": el índice exacto (0-3) de la opción correcta.
- Campo "respuestaCorrectaTexto": el texto EXACTO de esa opción (copia carácter por carácter una de las "opciones").
- Varía la posición de la respuesta correcta entre las 4 opciones.`;

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
    "respuestaCorrectaTexto": "opción A",
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
    "respuestaCorrectaTexto": "opción A",
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

// ============================================================
// VALIDACIÓN + NORMALIZACIÓN DE PREGUNTAS
// ============================================================
// Regla de oro: acá NO se "adivina" la respuesta correcta.
// Si la IA devuelve un dato incoherente, la pregunta se DESCARTA y se registra
// en logs/ia-respuestas-invalidas.jsonl, en lugar de convertirse en silencio en
// "la opción A es la correcta" (eso era lo que rompía el feedback de la arena).

const DIFICULTADES_VALIDAS = ['baby', 'conocedor', 'killer'];

// Sinónimos aceptados: la IA a veces responde el nivel en español.
const SINONIMOS_DIFICULTAD = {
  asesino: 'killer',
  experto: 'conocedor',
  facil: 'baby',
  'fácil': 'baby',
  medio: 'conocedor',
  dificil: 'killer',
  'difícil': 'killer'
};

const extraerArrayDePreguntas = (preguntasRaw) => {
  let data = preguntasRaw;
  if (!Array.isArray(data)) {
    const keys = ["preguntas", "questions", "items", "trivia", "data"];
    for (const key of keys) {
      if (data && data[key] && Array.isArray(data[key])) { data = data[key]; break; }
    }
  }
  if (!Array.isArray(data) && typeof data === "object" && data !== null) {
    data = Object.values(data).filter((item) => typeof item === "object" && item !== null);
  }
  if (!Array.isArray(data)) data = [data];
  return data;
};

const normalizarTexto = (valor) => typeof valor === 'string'
  ? valor.trim().toLowerCase().replace(/\s+/g, ' ')
  : valor;

// Busca el texto indicado entre las opciones (tolerante a mayúsculas y espacios)
const buscarOpcionPorTexto = (opciones, texto) => {
  if (typeof texto !== 'string' || !texto.trim()) return -1;
  return opciones.findIndex((o) => normalizarTexto(o) === normalizarTexto(texto));
};

// La IA a veces copia el ejemplo del prompt en lugar de responder; en ese caso
// el texto no aporta información y se usa el índice.
const PLACEHOLDERS_RESPUESTA = new Set([
  'a', 'opcion a', 'opción a', 'opcion correcta', 'opción correcta',
  'texto de la opcion correcta', 'texto de la opción correcta',
  'texto exacto de la opcion correcta', 'texto exacto de la opción correcta',
  'texto de la respuesta correcta', 'respuesta correcta', 'correcta'
]);

const esPlaceholderRespuesta = (texto) => typeof texto === 'string' && PLACEHOLDERS_RESPUESTA.has(normalizarTexto(texto));

/**
 * Resuelve el índice de la respuesta correcta.
 * Prioridad: el TEXTO (es lo que el modelo "razona"); si no viene, el índice
 * numérico; y si el índice llegó como texto, se busca ese texto entre opciones.
 * Nunca devuelve un índice "por defecto".
 */
const resolverIndiceCorrecto = (p, opciones) => {
  const textoRespuesta = p.respuestaCorrectaTexto ?? p.respuestaTexto ?? p.correctAnswer ?? p.answerText;
  const indiceRaw = p.respuestaCorrecta ?? p.answer ?? p.correctIndex;
  const textoUtil = typeof textoRespuesta === 'string' && textoRespuesta.trim() && !esPlaceholderRespuesta(textoRespuesta);

  if (textoUtil) {
    const pos = buscarOpcionPorTexto(opciones, textoRespuesta);
    if (pos >= 0) return { indice: pos, origen: 'texto' };
    // El texto no coincide con ninguna opción y el índice declarado no es
    // confiable (la IA suele repetir el "0" del ejemplo del prompt): no adivinamos.
    return { indice: null, motivo: `"respuestaCorrectaTexto" ("${textoRespuesta}") no coincide con ninguna de las opciones` };
  }

  if (Number.isInteger(indiceRaw)) {
    if (indiceRaw >= 0 && indiceRaw < opciones.length) return { indice: indiceRaw, origen: 'indice' };
    return { indice: null, motivo: `"respuestaCorrecta" fuera de rango: ${indiceRaw}` };
  }

  if (typeof indiceRaw === 'string' && indiceRaw.trim()) {
    const pos = buscarOpcionPorTexto(opciones, indiceRaw);
    if (pos >= 0) return { indice: pos, origen: 'texto en "respuestaCorrecta"' };
    return { indice: null, motivo: `"respuestaCorrecta" no es un índice (0-3) ni coincide con una opción: "${indiceRaw}"` };
  }

  return { indice: null, motivo: `"respuestaCorrecta" ausente o con tipo inválido: ${JSON.stringify(indiceRaw)}` };
};

/**
 * Normaliza y valida UNA pregunta cruda de la IA.
 * @returns {{ pregunta?: object, motivos?: string[], advertencias?: string[] }}
 *          Si hay "motivos", la pregunta NO es utilizable.
 */
const normalizarPregunta = (p, tematicas) => {
  if (!p || typeof p !== 'object') {
    return { motivos: [`la pregunta no es un objeto: ${JSON.stringify(p)}`] };
  }

  const motivos = [];
  const advertencias = [];

  const opcionesRaw = p.opciones ?? p.options ?? p.choices;
  const opciones = Array.isArray(opcionesRaw) ? opcionesRaw : null;

  if (!opciones) {
    motivos.push('el campo "opciones" no es un array');
  } else {
    if (opciones.length !== 4) motivos.push(`se esperaban 4 opciones y llegaron ${opciones.length}`);
    if (opciones.some((o) => typeof o !== 'string' || !o.trim())) motivos.push('hay opciones vacías o que no son texto');
    const normalizadas = opciones.map((o) => normalizarTexto(o));
    if (new Set(normalizadas).size !== normalizadas.length) motivos.push('hay opciones repetidas');
  }

  const textoPregunta = (typeof p.pregunta === 'string' && p.pregunta.trim()) ? p.pregunta : p.question;
  if (typeof textoPregunta !== 'string' || !textoPregunta.trim()) motivos.push('la pregunta no tiene texto');

  let dificultad = p.dificultad ?? p.difficulty;
  if (typeof dificultad === 'string') {
    const normal = normalizarTexto(dificultad);
    if (DIFICULTADES_VALIDAS.includes(normal)) {
      dificultad = normal;
    } else if (SINONIMOS_DIFICULTAD[normal]) {
      advertencias.push(`dificultad "${dificultad}" interpretada como "${SINONIMOS_DIFICULTAD[normal]}"`);
      dificultad = SINONIMOS_DIFICULTAD[normal];
    } else {
      motivos.push(`dificultad inválida: ${JSON.stringify(dificultad)}`);
    }
  } else {
    motivos.push(`dificultad ausente o con tipo inválido: ${JSON.stringify(dificultad)}`);
  }

  const tematica = p.tematica ?? p.category ?? p.topic ?? tematicas[0] ?? 'General';
  if (Array.isArray(tematicas) && tematicas.length && !tematicas.includes(tematica)) {
    advertencias.push(`temática no pedida: ${JSON.stringify(tematica)}`);
  }

  let indice = null;
  let origenRespuesta = null;
  const opcionesLimpias = opciones ? opciones.map((o) => String(o).trim()) : null;

  if (opcionesLimpias && motivos.length === 0) {
    const resolucion = resolverIndiceCorrecto(p, opcionesLimpias);
    if (resolucion.indice === null) motivos.push(resolucion.motivo);
    else {
      indice = resolucion.indice;
      origenRespuesta = resolucion.origen;
    }
  }

  if (motivos.length) return { motivos, advertencias };

  return {
    pregunta: {
      pregunta: String(textoPregunta).trim(),
      opciones: opcionesLimpias,
      respuestaCorrecta: indice,
      respuestaCorrectaTexto: opcionesLimpias[indice],
      tematica,
      dificultad
    },
    origenRespuesta,
    advertencias
  };
};

/**
 * Procesa la respuesta cruda de la IA y separa lo utilizable de lo descartado.
 * @returns {{ validas: object[], invalidas: object[], advertencias: object[], total: number }}
 */
const prepararPreguntas = (preguntasRaw, tematicas) => {
  const items = extraerArrayDePreguntas(preguntasRaw);
  const validas = [];
  const invalidas = [];
  const advertencias = [];

  items.forEach((p, i) => {
    const r = normalizarPregunta(p, tematicas);
    if (r.motivos && r.motivos.length) {
      invalidas.push({ indice: i, motivos: r.motivos, crudo: p });
    } else {
      validas.push(r.pregunta);
      if (r.advertencias && r.advertencias.length) advertencias.push({ indice: i, advertencias: r.advertencias });
    }
  });

  return { validas, invalidas, advertencias, total: items.length };
};

/**
 * Baraja las opciones de una pregunta manteniendo el índice coherente.
 * El índice se recalcula buscando el TEXTO de la respuesta correcta, así que es
 * imposible que quede apuntando a otra opción.
 * Elimina el sesgo "la respuesta correcta siempre es la A".
 */
const barajarOpciones = (pregunta) => {
  const opciones = pregunta.opciones.slice();
  const textoCorrecto = opciones[pregunta.respuestaCorrecta];
  for (let i = opciones.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [opciones[i], opciones[j]] = [opciones[j], opciones[i]];
  }
  return {
    ...pregunta,
    opciones,
    respuestaCorrecta: opciones.indexOf(textoCorrecto),
    respuestaCorrectaTexto: textoCorrecto
  };
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
      const { validas, invalidas, advertencias, total } = prepararPreguntas(parsed, tematicas);

      // Advertencias: no descartan la pregunta, pero quedan registradas
      advertencias.forEach((a) => {
        console.warn(`⚠️ [${plan.name}] Pregunta ${a.indice + 1}: ${a.advertencias.join(' | ')}`);
      });

      // Validación de CONTENIDO: si alguna pregunta no cumple el contrato se
      // descarta la respuesta completa y se prueba con el siguiente motor.
      // (Antes solo se validaba la cantidad y el índice inválido se convertía en "A").
      if (invalidas.length > 0) {
        console.warn(`⚠️ [${plan.name}] ${invalidas.length} de ${total} preguntas descartadas por formato inválido:`);
        invalidas.forEach((i) => console.warn(`   • Pregunta ${i.indice + 1}: ${i.motivos.join(' | ')}`));
        registrarInvalida({ plan: plan.name, motor: plan.label, tematicas, invalidas, crudo: parsed });
        continue;
      }

      // Validación de conteo si se especificó
      if (expectedCount && validas.length !== expectedCount) {
        console.warn(`⚠️ [${plan.name}] Se esperaban ${expectedCount} preguntas, se recibieron ${validas.length}. Intentando siguiente...`);
        continue;
      }

      // Barajado: la opción correcta ya no queda siempre en la posición A
      const preguntas = validas.map(barajarOpciones);

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
  generateTrainingQuestions,
  // Exportadas para los tests deterministas y el script de verificación
  prepararPreguntas,
  barajarOpciones,
  resolverIndiceCorrecto
};
