const crypto = require('crypto');
const encuestaService = require('../services/encuestaService');

/**
 * Controller de la encuesta de bienvenida.
 * Se encarga de la validación del payload, el rate limit por IP y de delegar
 * el guardado en encuestaService.
 */

// --- Configuración -----------------------------------------------------------

/** Textos: se recortan a estos largos máximos para que nadie inyecte megabytes. */
const MAX_TEXTO = 300;
const MAX_COMENTARIO = 500;
const MAX_USER_AGENT = 500;

/** Rate limit: máximo de envíos por IP dentro de la ventana. */
const VENTANA_MS = 10 * 60 * 1000;
const MAX_ENVIOS_POR_VENTANA = 30;

/** IDs de las respuestas esperadas, según el estado de la encuesta. */
const RESPUESTAS_COMPLETAS = ['nivelEducativo', 'experienciaTradicional', 'comoAprende', 'sumariaLaApp'];
const RESPUESTAS_EXCLUIDAS = ['nivelEducativo'];

// Todas las preguntas son de UNA sola opción. No hay lista de preguntas
// multi-opción a propósito: una respuesta exclusiva por pregunta es lo que
// permite contar los resultados sin ambigüedad.

// --- Rate limit en memoria ---------------------------------------------------
// Nota: es por proceso. Alcanza para frenar abuso casual; si algún día el back
// corre en varias instancias, esto debería moverse a Firestore o Redis.
const enviosPorIp = new Map();

const obtenerIp = (req) => {
    const reenviada = (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim();
    return reenviada || req.ip || req.socket?.remoteAddress || 'desconocida';
};

const superaRateLimit = (ip) => {
    const ahora = Date.now();
    const registro = enviosPorIp.get(ip) || { inicio: ahora, cantidad: 0 };

    if (ahora - registro.inicio > VENTANA_MS) {
        registro.inicio = ahora;
        registro.cantidad = 0;
    }

    registro.cantidad += 1;
    enviosPorIp.set(ip, registro);

    // Limpieza simple para que el Map no crezca sin control.
    if (enviosPorIp.size > 5000) {
        for (const [clave, valor] of enviosPorIp) {
            if (ahora - valor.inicio > VENTANA_MS) enviosPorIp.delete(clave);
        }
    }

    return registro.cantidad > MAX_ENVIOS_POR_VENTANA;
};

// --- Helpers de validación ---------------------------------------------------

/** Limpia un texto: recorta espacios, quita caracteres de control y limita el largo. */
const limpiarTexto = (valor, max = MAX_TEXTO) => {
    if (typeof valor !== 'string') return '';
    return valor
        .replace(/[\u0000-\u001F\u007F]/g, ' ')
        .trim()
        .slice(0, max);
};

/** Valida y normaliza las respuestas según el estado de la encuesta. */
const validarRespuestas = (estado, respuestas) => {
    const esperadas = estado === 'completada'
        ? RESPUESTAS_COMPLETAS
        : estado === 'excluida'
            ? RESPUESTAS_EXCLUIDAS
            : [];

    const limpias = {};

    for (const clave of esperadas) {
        const valor = respuestas?.[clave];

        // Una sola opción por pregunta: es lo que permite contar los resultados
        // sin ambigüedad (porcentajes que suman 100). Si llega una lista, se
        // rechaza en lugar de guardar un dato que después no se puede tabular.
        if (Array.isArray(valor)) {
            throw new Error(`Solo se admite una opción por pregunta: ${clave}`);
        }

        const texto = limpiarTexto(valor);
        if (!texto) {
            throw new Error(`Falta responder: ${clave}`);
        }
        limpias[clave] = texto;
    }

    return limpias;
};

/** Valida y normaliza datos técnicos opcionales. */
const validarDispositivo = (dispositivo = {}) => ({
    so: limpiarTexto(dispositivo?.so, 60) || null,
    navegador: limpiarTexto(dispositivo?.navegador, 60) || null,
    pwaInstalada: Boolean(dispositivo?.pwaInstalada),
    pantalla: limpiarTexto(dispositivo?.pantalla, 30) || null,
    userAgent: limpiarTexto(dispositivo?.userAgent, MAX_USER_AGENT) || null
});

const validarContexto = (contexto = {}) => ({
    zonaHoraria: limpiarTexto(contexto?.zonaHoraria, 60) || null,
    idioma: limpiarTexto(contexto?.idioma, 20) || null,
    plataforma: limpiarTexto(contexto?.plataforma, 60) || null,
    abrioEn: limpiarTexto(contexto?.abrioEn, 40) || null
});

const aNumero = (valor, minimo, maximo, porDefecto = 0) => {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return porDefecto;
    return Math.min(Math.max(Math.round(numero), minimo), maximo);
};

// --- Endpoints ---------------------------------------------------------------

/**
 * POST /encuesta/submit
 * Guarda la respuesta. Es idempotente: si el navegador reintenta, se actualiza
 * el mismo documento en lugar de duplicarlo.
 */
const submit = async (req, res) => {
    const ip = obtenerIp(req);

    try {
        if (superaRateLimit(ip)) {
            console.warn(`🚫 [Encuesta] Rate limit superado por ${ip}`);
            return res.status(429).json({
                success: false,
                error: 'Demasiados envíos. Probá de nuevo en unos minutos.'
            });
        }

        const cuerpo = req.body || {};
        const estado = limpiarTexto(cuerpo.estado, 20);

        if (!encuestaService.ESTADOS_VALIDOS.includes(estado)) {
            return res.status(400).json({
                success: false,
                error: `Estado inválido. Debe ser uno de: ${encuestaService.ESTADOS_VALIDOS.join(', ')}`
            });
        }

        const deviceId = limpiarTexto(cuerpo.deviceId, 120);
        const uidAnonimo = limpiarTexto(cuerpo.uidAnonimo, 120);

        if (!deviceId && !uidAnonimo) {
            return res.status(400).json({
                success: false,
                error: 'Se requiere deviceId o uidAnonimo para identificar el dispositivo'
            });
        }

        let respuestas = {};
        try {
            respuestas = validarRespuestas(estado, cuerpo.respuestas);
        } catch (errorDeValidacion) {
            return res.status(400).json({ success: false, error: errorDeValidacion.message });
        }

        const resultado = await encuestaService.guardarRespuesta({
            estado,
            deviceId,
            uidAnonimo,
            idToken: typeof cuerpo.idToken === 'string' ? cuerpo.idToken : null,
            respuestas,
            comentario: limpiarTexto(cuerpo.comentario, MAX_COMENTARIO),
            dispositivo: validarDispositivo(cuerpo.dispositivo),
            contexto: validarContexto(cuerpo.contexto),
            tiempoDeLlenadoSeg: aNumero(cuerpo.tiempoDeLlenadoSeg, 0, 86400),
            intentosDeEnvio: aNumero(cuerpo.intentosDeEnvio, 0, 100),
            honeypot: limpiarTexto(cuerpo.honeypot, 100),
            abrioEn: limpiarTexto(cuerpo.abrioEn, 40) || null,
            ip
        });

        return res.json({
            success: true,
            id: resultado.id,
            // Si la respuesta ya estaba cerrada, se devuelve el estado guardado
            // (el envío se ignora) y no el que mandó el cliente.
            estado: resultado.estado || estado,
            duplicada: resultado.duplicada,
            motivo: resultado.motivo || null
        });

    } catch (error) {
        console.error('❌ Error en encuestaController.submit:', error);
        return res.status(500).json({
            success: false,
            error: 'No se pudo guardar la respuesta. Reintentá en unos instantes.'
        });
    }
};

/**
 * POST /encuesta/vincular
 * Enriquece la respuesta anónima con la cuenta real (correo verificado, nombre
 * y uid) después de que el usuario se loguea con Google.
 */
const vincular = async (req, res) => {
    const ip = obtenerIp(req);

    try {
        if (superaRateLimit(ip)) {
            return res.status(429).json({ success: false, error: 'Demasiadas solicitudes.' });
        }

        const cuerpo = req.body || {};
        const idToken = typeof cuerpo.idToken === 'string' ? cuerpo.idToken : null;

        if (!idToken) {
            return res.status(400).json({ success: false, error: 'Se requiere idToken' });
        }

        const resultado = await encuestaService.vincularRespuesta({
            deviceId: limpiarTexto(cuerpo.deviceId, 120),
            uidAnonimo: limpiarTexto(cuerpo.uidAnonimo, 120),
            idToken,
            ip
        });

        return res.json({ success: true, ...resultado });

    } catch (error) {
        const codigo = error?.estadoHttp || 500;

        // Un token inválido es un error del cliente, no del servidor: no se loguea como fallo grave.
        if (codigo >= 500) {
            console.error('❌ Error en encuestaController.vincular:', error);
        }

        return res.status(codigo).json({
            success: false,
            error: codigo === 401
                ? 'El ID token es inválido o expiró.'
                : 'No se pudo vincular la respuesta.'
        });
    }
};

// --- Panel de estadísticas ---------------------------------------------------
// La clave vive SOLO en el entorno del backend (`ENCUESTA_CLAVE`). No se escribe
// nunca en el código del front: si estuviera ahí, cualquiera la leería del bundle.

/** Intentos de clave fallidos por IP, para que no se pueda adivinar a fuerza bruta. */
const MAX_INTENTOS_CLAVE = 10;
const VENTANA_CLAVE_MS = 10 * 60 * 1000;
const intentosClavePorIp = new Map();

/** Huella de una clave: comparar huellas evita filtrar hasta el largo de la clave. */
const huella = (texto) => crypto.createHash('sha256').update(String(texto)).digest();

/** Compara dos claves en tiempo constante. */
const clavesIguales = (recibida, esperada) =>
    crypto.timingSafeEqual(huella(recibida), huella(esperada));

const intentosVigentes = (ip) => {
    const ahora = Date.now();
    const registro = intentosClavePorIp.get(ip) || { inicio: ahora, cantidad: 0 };

    if (ahora - registro.inicio > VENTANA_CLAVE_MS) {
        registro.inicio = ahora;
        registro.cantidad = 0;
    }

    intentosClavePorIp.set(ip, registro);
    return registro;
};

const claveBloqueada = (ip) => intentosVigentes(ip).cantidad >= MAX_INTENTOS_CLAVE;

const registrarIntentoFallido = (ip) => {
    const registro = intentosVigentes(ip);
    registro.cantidad += 1;
    intentosClavePorIp.set(ip, registro);
};

/**
 * GET /encuesta/estadisticas
 * Devuelve la ficha técnica, las distribuciones y la sábana de respuestas.
 *
 * La clave se manda por header (`x-clave-acceso`), nunca por la URL: así no queda
 * en el historial del navegador ni en los logs del servidor.
 * Sin la variable de entorno el panel queda cerrado (503) en lugar de abierto.
 */
const estadisticas = async (req, res) => {
    const ip = obtenerIp(req);

    try {
        const claveEsperada = process.env.ENCUESTA_CLAVE;

        if (!claveEsperada) {
            console.error('❌ [Panel] Falta ENCUESTA_CLAVE en el entorno: panel deshabilitado');
            return res.status(503).json({
                success: false,
                error: 'El panel no está configurado.'
            });
        }

        if (claveBloqueada(ip)) {
            return res.status(429).json({
                success: false,
                error: 'Demasiados intentos fallidos. Esperá unos minutos.',
                bloqueado: true
            });
        }

        const claveRecibida = (req.get('x-clave-acceso') || '').trim();

        if (!claveRecibida) {
            return res.status(401).json({
                success: false,
                error: 'Se requiere la clave de acceso.',
                requiereClave: true
            });
        }

        if (!clavesIguales(claveRecibida, claveEsperada)) {
            registrarIntentoFallido(ip);
            console.warn(`🔒 [Panel] Intento con clave incorrecta desde ${ip}`);
            return res.status(401).json({
                success: false,
                error: 'La clave no es correcta.',
                requiereClave: true
            });
        }

        // Clave correcta: se limpian los intentos fallidos de esta IP.
        intentosClavePorIp.delete(ip);

        const datos = await encuestaService.obtenerPanelEstadisticas();
        return res.json({ success: true, ...datos });

    } catch (error) {
        console.error('❌ Error en encuestaController.estadisticas:', error);
        return res.status(500).json({
            success: false,
            error: 'No se pudieron obtener las estadísticas.'
        });
    }
};

module.exports = {
    submit,
    vincular,
    estadisticas
};
