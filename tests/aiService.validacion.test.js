// ============================================================
// TESTS DETERMINISTAS DE LA VALIDACIÓN DE PREGUNTAS DE IA
// ============================================================
// No usan la IA real: se reemplaza global.fetch por respuestas fabricadas.
// Correr con:  npm test        (node --test tests/)
//
// Cubren el bug del feedback de la arena: la IA devolvía un "respuestaCorrecta"
// incoherente (o un texto como "Los Ramones") y el backend lo convertía en
// silencio en "la opción A es la correcta".

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const aiService = require('../src/services/aiService');
const { ARCHIVO: ARCHIVO_AUDITORIA } = require('../src/utils/iaAuditoria');

const TEMATICAS = ['Cine', 'Los Ramones'];
const OPCIONES_CINE = ['48 fps', '60 fps', '72 fps', '120 fps'];
const DIFICULTADES = ['baby', 'conocedor', 'killer'];

// --- utilidades de simulación de la IA -------------------------------------

const comoGemini = (preguntas) => ({
  candidates: [{ content: { parts: [{ text: JSON.stringify(preguntas) }] } }]
});

const comoOpenAI = (preguntas) => ({
  choices: [{ message: { content: JSON.stringify(preguntas) } }]
});

/**
 * Reemplaza global.fetch. `handler(url, numeroDeLlamada)` devuelve el cuerpo JSON
 * que "respondería" el motor de IA.
 */
const simularIA = (handler) => {
  const original = global.fetch;
  const llamadas = [];
  global.fetch = async (url) => {
    const u = String(url);
    llamadas.push(u);
    const cuerpo = handler(u, llamadas.length);
    return {
      ok: true,
      status: 200,
      json: async () => cuerpo,
      text: async () => JSON.stringify(cuerpo)
    };
  };
  return {
    llamadas,
    motores: () => llamadas.map((u) => (u.includes('generativelanguage') ? 'Gemini' : u.includes('groq') ? 'Groq' : 'otro')),
    restaurar: () => { global.fetch = original; }
  };
};

// 6 preguntas válidas (es lo que se espera para 2 temáticas: tematicas * 3)
const setValido = () => Array.from({ length: 6 }, (_, i) => ({
  pregunta: `Pregunta de prueba ${i + 1}`,
  opciones: [...OPCIONES_CINE],
  respuestaCorrecta: 1,
  respuestaCorrectaTexto: '60 fps',
  tematica: i < 3 ? 'Cine' : 'Los Ramones',
  dificultad: DIFICULTADES[i % 3]
}));

const conPrimera = (pregunta) => [pregunta, ...setValido().slice(1)];

const primeraPregunta = (extra = {}) => ({
  pregunta: '¿A cuántos fotogramas por segundo proyecta Showscan?',
  opciones: [...OPCIONES_CINE],
  respuestaCorrecta: 1,
  respuestaCorrectaTexto: '60 fps',
  tematica: 'Cine',
  dificultad: 'killer',
  ...extra
});

// --- tests -----------------------------------------------------------------

test('una respuesta coherente se acepta, mantiene la coherencia y baraja las opciones', async () => {
  const ia = simularIA(() => comoGemini(setValido()));
  try {
    const res = await aiService.generateQuestions(TEMATICAS);

    assert.equal(res.success, true, 'debería aceptar el set válido');
    assert.equal(res.preguntas.length, 6);

    for (const p of res.preguntas) {
      assert.equal(p.opciones.length, 4);
      assert.ok(Number.isInteger(p.respuestaCorrecta), 'respuestaCorrecta debe ser un entero');
      assert.ok(p.respuestaCorrecta >= 0 && p.respuestaCorrecta < 4);
      // La clave: el índice SIEMPRE apunta al texto de la respuesta correcta
      assert.equal(p.opciones[p.respuestaCorrecta], p.respuestaCorrectaTexto);
      // No se pierde ni se duplica ninguna opción
      assert.deepEqual([...p.opciones].sort(), [...OPCIONES_CINE].sort());
      assert.ok(DIFICULTADES.includes(p.dificultad));
    }
  } finally {
    ia.restaurar();
  }
});

test('BUG de la captura: si el índice y el texto no coinciden, manda el texto', async () => {
  const ia = simularIA(() => comoGemini(conPrimera(primeraPregunta({
    respuestaCorrecta: 0,              // la IA dijo "la A"...
    respuestaCorrectaTexto: '60 fps'   // ...pero el texto correcto es la B
  }))));
  try {
    const res = await aiService.generateQuestions(TEMATICAS);
    assert.equal(res.success, true);

    const p = res.preguntas[0];
    assert.equal(p.respuestaCorrectaTexto, '60 fps');
    assert.equal(p.opciones[p.respuestaCorrecta], '60 fps',
      'el índice debe apuntar a "60 fps" (antes marcaba "48 fps" como correcta)');
  } finally {
    ia.restaurar();
  }
});

test('un texto de respuesta que no está entre las opciones se descarta (no cae en la opción A)', async () => {
  const ia = simularIA(() => comoGemini(conPrimera(primeraPregunta({
    respuestaCorrecta: 'Los Ramones',   // justo lo que se veía en la captura
    respuestaCorrectaTexto: undefined
  }))));
  try {
    const res = await aiService.generateQuestions(TEMATICAS);

    assert.equal(res.success, false, 'la respuesta completa debe rechazarse');
    assert.equal(res.preguntas, undefined);

    // Debe quedar registrado en la auditoría para poder revisarlo después
    assert.ok(fs.existsSync(ARCHIVO_AUDITORIA), 'debería existir el archivo de auditoría');
    const auditoria = fs.readFileSync(ARCHIVO_AUDITORIA, 'utf8');
    assert.match(auditoria, /Los Ramones/);
  } finally {
    ia.restaurar();
  }
});

test('un índice fuera de rango (4) se rechaza; pero si hay texto válido, el texto manda', async () => {
  const iaMal = simularIA(() => comoGemini(conPrimera(primeraPregunta({ respuestaCorrecta: 4, respuestaCorrectaTexto: undefined }))));
  try {
    const res = await aiService.generateQuestions(TEMATICAS);
    assert.equal(res.success, false, '4 no es un índice válido (0-3)');
  } finally {
    iaMal.restaurar();
  }

  const iaBien = simularIA(() => comoGemini(conPrimera(primeraPregunta({ respuestaCorrecta: 4, respuestaCorrectaTexto: '60 fps' }))));
  try {
    const res = await aiService.generateQuestions(TEMATICAS);
    assert.equal(res.success, true, 'con texto válido se puede resolver la respuesta');
    assert.equal(res.preguntas[0].opciones[res.preguntas[0].respuestaCorrecta], '60 fps');
  } finally {
    iaBien.restaurar();
  }
});

test('texto de respuesta incoherente: se rechaza aunque el índice sea plausible (no cae en la A)', async () => {
  const ia = simularIA(() => comoGemini(conPrimera(primeraPregunta({
    respuestaCorrecta: 0,                 // el "0" del ejemplo del prompt
    respuestaCorrectaTexto: 'Los Ramones' // texto cruzado desde otra temática
  }))));
  try {
    const res = await aiService.generateQuestions(TEMATICAS);
    assert.equal(res.success, false, 'no se debe adivinar la opción A');
  } finally {
    ia.restaurar();
  }
});

test('si la IA copia el ejemplo del prompt ("opción A") como texto, se usa el índice', async () => {
  const ia = simularIA(() => comoGemini(setValido().map((p) => ({ ...p, respuestaCorrectaTexto: 'opción A' }))));
  try {
    const res = await aiService.generateQuestions(TEMATICAS);
    assert.equal(res.success, true);
    for (const p of res.preguntas) {
      assert.equal(p.respuestaCorrectaTexto, '60 fps', 'el placeholder no debe reemplazar a la respuesta real');
      assert.equal(p.opciones[p.respuestaCorrecta], '60 fps');
    }
  } finally {
    ia.restaurar();
  }
});

test('opciones mal formadas se descartan (3 opciones, repetidas o vacías)', async () => {
  const casos = {
    '3 opciones': { opciones: ['48 fps', '60 fps', '72 fps'] },
    'repetidas': { opciones: ['60 fps', '60 fps', '72 fps', '120 fps'] },
    'vacía': { opciones: ['48 fps', '', '72 fps', '120 fps'] }
  };

  for (const [nombre, extra] of Object.entries(casos)) {
    const ia = simularIA(() => comoGemini(conPrimera(primeraPregunta(extra))));
    try {
      const res = await aiService.generateQuestions(TEMATICAS);
      assert.equal(res.success, false, `debería rechazar el caso "${nombre}"`);
    } finally {
      ia.restaurar();
    }
  }
});

test('dificultad: "asesino" se interpreta como killer, una desconocida se descarta', async () => {
  const iaSinonimo = simularIA(() => comoGemini(setValido().map((p) => ({ ...p, dificultad: 'asesino' }))));
  try {
    const res = await aiService.generateQuestions(TEMATICAS);
    assert.equal(res.success, true);
    for (const p of res.preguntas) assert.equal(p.dificultad, 'killer');
  } finally {
    iaSinonimo.restaurar();
  }

  const iaInvalida = simularIA(() => comoGemini(setValido().map((p) => ({ ...p, dificultad: 'imposible' }))));
  try {
    const res = await aiService.generateQuestions(TEMATICAS);
    assert.equal(res.success, false);
  } finally {
    iaInvalida.restaurar();
  }
});

test('si un motor devuelve datos inválidos, se prueba con el siguiente (fallback)', async () => {
  const ia = simularIA((url) => url.includes('generativelanguage')
    ? comoGemini(conPrimera(primeraPregunta({ respuestaCorrecta: 0, respuestaCorrectaTexto: 'Los Ramones' })))
    : comoOpenAI(setValido()));
  try {
    const res = await aiService.generateQuestions(TEMATICAS);

    assert.equal(res.success, true, 'el segundo motor tenía datos válidos');
    assert.match(res.aiUsada, /Groq/);
    assert.deepEqual(ia.motores().slice(0, 2), ['Gemini', 'Groq']);
  } finally {
    ia.restaurar();
  }
});

test('barajarOpciones conserva la respuesta correcta y reparte todas las posiciones', () => {
  const pregunta = {
    pregunta: 'prueba',
    opciones: ['uno', 'dos', 'tres', 'cuatro'],
    respuestaCorrecta: 0,
    respuestaCorrectaTexto: 'uno',
    tematica: 'Cine',
    dificultad: 'baby'
  };

  const posiciones = new Set();
  for (let i = 0; i < 300; i++) {
    const r = aiService.barajarOpciones(pregunta);
    assert.equal(r.opciones[r.respuestaCorrecta], 'uno', 'la correcta se conserva siempre');
    assert.deepEqual([...r.opciones].sort(), ['cuatro', 'dos', 'tres', 'uno'], 'no se pierde ninguna opción');
    posiciones.add(r.respuestaCorrecta);
  }

  assert.deepEqual([...posiciones].sort(), [0, 1, 2, 3],
    'con 300 barajados la respuesta correcta debe aparecer en las 4 posiciones (antes era siempre la A)');
});

test('el motor de entrenamiento usa la misma validación', async () => {
  const cincoValidas = setValido().slice(0, 5);
  const ia = simularIA(() => comoGemini(cincoValidas));
  try {
    const res = await aiService.generateTrainingQuestions('Cine', 'baby', 5);
    assert.equal(res.success, true);
    assert.equal(res.preguntas.length, 5);
    for (const p of res.preguntas) {
      assert.equal(p.opciones[p.respuestaCorrecta], p.respuestaCorrectaTexto);
    }
  } finally {
    ia.restaurar();
  }
});
