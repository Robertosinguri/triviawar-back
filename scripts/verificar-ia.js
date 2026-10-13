#!/usr/bin/env node
// ============================================================
// VERIFICACIÓN EN VIVO DE LA GENERACIÓN DE PREGUNTAS CON IA
// ============================================================
// Genera partidas reales y audita lo que devuelve la IA:
//   • cuántas preguntas vienen mal formadas (se descartarían)
//   • en qué posición cae la respuesta correcta (sesgo "siempre la A")
//   • cuántas veces el índice y el texto de la respuesta NO coinciden
//     (esa es la causa del feedback incorrecto que se veía en la arena)
//
// Uso:
//   npm run verificar-ia                 (3 partidas, temas Cine + Los Ramones)
//   npm run verificar-ia -- 5 Cine Fútbol
//
// Necesita las API keys de los motores de IA (archivo .env del backend).
// Nunca toca la base de datos: solo llama a los motores de IA.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const aiService = require('../src/services/aiService');
const { ARCHIVO: ARCHIVO_AUDITORIA } = require('../src/utils/iaAuditoria');

const argumentos = process.argv.slice(2);
const partidas = Math.max(1, Number(argumentos[0]) || 3);
const tematicas = argumentos.slice(1).length ? argumentos.slice(1) : ['Cine', 'Los Ramones'];
const POSICIONES = ['A', 'B', 'C', 'D'];

// --- captura de las respuestas CRUDAS de la IA ------------------------------

const crudas = [];

const pareceListaDePreguntas = (valor) => {
  if (Array.isArray(valor)) {
    return valor.length > 0 && valor.some((x) => x && typeof x === 'object'
      && ('pregunta' in x || 'question' in x || 'opciones' in x || 'options' in x));
  }
  if (valor && typeof valor === 'object') {
    return ['preguntas', 'questions', 'items', 'trivia', 'data'].some((k) => Array.isArray(valor[k]));
  }
  return false;
};

const parseOriginal = JSON.parse;
JSON.parse = function (...args) {
  const resultado = parseOriginal.apply(this, args);
  if (pareceListaDePreguntas(resultado)) crudas.push(resultado);
  return resultado;
};

const itemsDe = (raw) => {
  if (Array.isArray(raw)) return raw;
  for (const k of ['preguntas', 'questions', 'items', 'trivia', 'data']) {
    if (raw && Array.isArray(raw[k])) return raw[k];
  }
  return [];
};

// --- análisis de una respuesta cruda ---------------------------------------

const analizar = (raw) => {
  const items = itemsDe(raw);
  const { validas, invalidas, advertencias } = aiService.prepararPreguntas(raw, tematicas);

  const indices = {};
  let coinciden = 0;
  let noCoinciden = 0;
  let sinTexto = 0;

  items.forEach((p) => {
    if (!p || typeof p !== 'object') return;
    const idx = p.respuestaCorrecta ?? p.answer ?? p.correctIndex;
    const clave = Number.isInteger(idx) && idx >= 0 && idx < 4 ? POSICIONES[idx] : `inválido (${JSON.stringify(idx)})`;
    indices[clave] = (indices[clave] || 0) + 1;

    const texto = p.respuestaCorrectaTexto ?? p.respuestaTexto ?? p.correctAnswer ?? p.answerText;
    if (typeof texto !== 'string' || !texto.trim()) {
      sinTexto++;
      return;
    }
    const opciones = p.opciones ?? p.options ?? p.choices;
    const coincide = Array.isArray(opciones) && Number.isInteger(idx)
      && String(opciones[idx]).trim().toLowerCase() === texto.trim().toLowerCase();
    if (coincide) coinciden++;
    else noCoinciden++;
  });

  return { total: items.length, validas: validas.length, invalidas, advertencias, indices, coinciden, noCoinciden, sinTexto };
};

// --- ejecución -------------------------------------------------------------

const acumulado = {
  partidas: 0, exitosas: 0, fallidas: 0,
  motores: {}, crudas: 0, preguntas: 0, descartadas: 0,
  indicesCrudos: {}, indicesFinales: {},
  coinciden: 0, noCoinciden: 0, sinTexto: 0
};

const contar = (acum, clave) => { acum[clave] = (acum[clave] || 0) + 1; };

const main = async () => {
  console.log('\n🧪 VERIFICACIÓN DE GENERACIÓN CON IA');
  console.log(`   Partidas: ${partidas} | Temáticas: ${tematicas.join(', ')}`);
  console.log(`   Preguntas esperadas por partida: ${tematicas.length * 3}\n`);

  for (let i = 1; i <= partidas; i++) {
    console.log(`──────────── Partida ${i}/${partidas} ────────────`);
    const antes = crudas.length;

    let resultado;
    const inicio = Date.now();
    try {
      resultado = await aiService.generateQuestions(tematicas);
    } catch (e) {
      resultado = { success: false, message: e.message };
    }
    const duracion = ((Date.now() - inicio) / 1000).toFixed(1);

    acumulado.partidas++;

    const nuevas = crudas.slice(antes);
    acumulado.crudas += nuevas.length;

    nuevas.forEach((raw, n) => {
      const a = analizar(raw);
      acumulado.preguntas += a.total;
      acumulado.descartadas += a.invalidas.length;
      acumulado.coinciden += a.coinciden;
      acumulado.noCoinciden += a.noCoinciden;
      acumulado.sinTexto += a.sinTexto;
      Object.entries(a.indices).forEach(([k, v]) => { acumulado.indicesCrudos[k] = (acumulado.indicesCrudos[k] || 0) + v; });

      console.log(`   📥 Respuesta cruda #${n + 1}: ${a.total} preguntas | utilizables: ${a.validas} | descartadas: ${a.invalidas.length}`);
      console.log(`      Índice declarado por la IA: ${Object.entries(a.indices).map(([k, v]) => `${k}×${v}`).join(', ')}`);
      console.log(`      Índice vs texto: coinciden ${a.coinciden} | NO coinciden ${a.noCoinciden} | sin texto ${a.sinTexto}`);
      a.invalidas.forEach((iv) => console.log(`      ❌ Pregunta ${iv.indice + 1}: ${iv.motivos.join(' | ')}`));
      a.advertencias.forEach((av) => console.log(`      ⚠️ Pregunta ${av.indice + 1}: ${av.advertencias.join(' | ')}`));
    });

    if (resultado.success) {
      acumulado.exitosas++;
      contar(acumulado.motores, resultado.aiUsada);
      resultado.preguntas.forEach((p) => contar(acumulado.indicesFinales, POSICIONES[p.respuestaCorrecta]));
      console.log(`   ✅ OK en ${duracion}s con ${resultado.aiUsada} → ${resultado.preguntas.length} preguntas listas para jugar`);
      const incoherentes = resultado.preguntas.filter((p) => p.opciones[p.respuestaCorrecta] !== p.respuestaCorrectaTexto);
      console.log(`   🔎 Preguntas con índice incoherente: ${incoherentes.length}`);
    } else {
      acumulado.fallidas++;
      console.log(`   ❌ FALLÓ en ${duracion}s: ${resultado.message}`);
    }
    console.log('');
  }

  // --- resumen -------------------------------------------------------------
  const pct = (parte, total) => (total > 0 ? `${Math.round((parte / total) * 100)}%` : '-');
  const tabla = (obj) => Object.entries(obj).sort().map(([k, v]) => `${k}: ${v} (${pct(v, acumulado.preguntas)})`).join('  |  ') || '(sin datos)';

  console.log('═════════════════ RESUMEN ═════════════════');
  console.log(`Partidas: ${acumulado.partidas} | exitosas: ${acumulado.exitosas} | fallidas: ${acumulado.fallidas}`);
  console.log(`Motores usados: ${Object.entries(acumulado.motores).map(([k, v]) => `${k}×${v}`).join(', ') || '-'}`);
  console.log(`Preguntas crudas: ${acumulado.preguntas} | descartadas por formato inválido: ${acumulado.descartadas} (${pct(acumulado.descartadas, acumulado.preguntas)})`);
  console.log(`Posición declarada por la IA: ${tabla(acumulado.indicesCrudos)}`);
  console.log(`   ↳ si "A" es casi todo, la IA tiene sesgo posicional (el backend ahora baraja)`);
  console.log(`Posición que ve el jugador (tras barajar): ${tabla(acumulado.indicesFinales)}`);
  console.log(`Índice vs texto de la respuesta: coinciden ${acumulado.coinciden} | NO coinciden ${acumulado.noCoinciden} | sin texto ${acumulado.sinTexto}`);
  console.log(`Auditoría de descartes: ${ARCHIVO_AUDITORIA}`);
  console.log('════════════════════════════════════════════\n');

  if (acumulado.descartadas > 0 || acumulado.fallidas > 0 || acumulado.noCoinciden > 0) {
    console.log('⚠️  Se detectaron problemas en la salida de la IA (ver detalle arriba).');
    process.exitCode = 1;
  } else {
    console.log('✅ Todo en orden: la IA respetó el contrato de formato.');
  }
};

main();
