// ============================================================
// AUDITORÍA DE RESPUESTAS INVÁLIDAS DE LA IA
// ============================================================
// Cada vez que la IA devuelve preguntas que no cumplen el contrato de formato
// (índice de respuesta inválido, opciones repetidas, dificultad desconocida, etc.)
// guardamos la respuesta CRUDA en un archivo JSONL para poder revisarla después.
//
// Ruta: triviawar-back/logs/ia-respuestas-invalidas.jsonl
// Cada línea es un JSON con: fecha, plan, motor, tematicas, motivos y la respuesta cruda.

const fs = require('fs');
const path = require('path');

const DIRECTORIO = path.join(__dirname, '..', '..', 'logs');
const ARCHIVO = path.join(DIRECTORIO, 'ia-respuestas-invalidas.jsonl');

const registrarInvalida = ({ plan, motor, tematicas, invalidas, crudo }) => {
    try {
        fs.mkdirSync(DIRECTORIO, { recursive: true });
        const registro = {
            fecha: new Date().toISOString(),
            plan: plan || null,
            motor: motor || null,
            tematicas: tematicas || [],
            descartadas: (invalidas || []).map((i) => ({ indice: i.indice, motivos: i.motivos })),
            crudo
        };
        fs.appendFileSync(ARCHIVO, JSON.stringify(registro) + '\n');
    } catch (e) {
        // Nunca rompemos la generación por un problema de auditoría
        console.warn('⚠️ No se pudo escribir la auditoría de IA:', e.message);
    }
};

module.exports = { registrarInvalida, ARCHIVO };
