const { db, auth } = require('../config/firebase');
const admin = require('firebase-admin');

/**
 * Servicio de la encuesta de bienvenida.
 *
 * Decisiones de diseño:
 * - El ID del documento es el uid anónimo de Firebase (o, si no hay, el deviceId
 *   generado por el navegador). Así el guardado es IDEMPOTENTE: si el usuario
 *   reintenta porque se le cortó la red, se sobreescribe el mismo documento en
 *   lugar de crear respuestas duplicadas.
 * - Un mismo dispositivo pasa por varios estados (aplazada -> completada), así que
 *   se guarda un `historial` de eventos y el `estado` actual.
 * - Cuando el usuario se loguea con Google, se enriquece el MISMO documento con
 *   el correo verificado y el uid real (vinculación).
 */

const COLECCION = 'mvpp-encuestas';
const ESTADOS_VALIDOS = ['completada', 'excluida', 'aplazada'];

/** Segundos mínimos de llenado: por debajo de esto se marca como sospechosa. */
const SEGUNDOS_MINIMOS = 8;

/**
 * Versión del cuestionario.
 *
 * Se guarda en cada respuesta para poder certificar con qué redacción se relevó
 * cada dato: si mañana se cambia una pregunta, el informe puede distinguir las
 * respuestas viejas de las nuevas en lugar de mezclarlas sin avisar.
 */
const VERSION_CUESTIONARIO = '1.0';

/**
 * Calcula el ID del documento a partir del uid anónimo o del deviceId.
 * @returns {string|null}
 */
const calcularIdDocumento = ({ uidAnonimo, deviceId }) => {
    const candidato = (uidAnonimo || deviceId || '').toString().trim();
    // Firestore no acepta '/' en el ID de un documento.
    return candidato ? candidato.replace(/\//g, '_').slice(0, 120) : null;
};

/**
 * Verifica un ID token de Firebase.
 * Devuelve el usuario decodificado o null si el token falta o es inválido.
 * NUNCA lanza: si el token no sirve, la respuesta se guarda igual pero marcada.
 */
const verificarToken = async (idToken) => {
    if (!idToken || typeof idToken !== 'string') return null;
    try {
        const decodificado = await auth.verifyIdToken(idToken);
        return decodificado;
    } catch (error) {
        console.warn('⚠️ [Encuesta] ID token inválido:', error.message);
        return null;
    }
};

/**
 * ¿El token corresponde a una sesión anónima?
 * Un usuario anónimo tiene uid, pero ni email ni nombre verificado: sirve para
 * identificar el dispositivo, nunca para completar los datos de una cuenta real.
 */
const esTokenAnonimo = (token) => token?.firebase?.sign_in_provider === 'anonymous';

/**
 * Deriva sistema operativo y navegador a partir del User-Agent, como respaldo
 * por si el front no los pudo determinar.
 */
const parsearUserAgent = (userAgent) => {
    // Ojo: el valor por defecto de un parámetro NO cubre el null, y el controller
    // puede mandar null cuando el front no pudo determinar el User-Agent.
    const ua = (userAgent || '').toString();

    let so = 'Desconocido';
    if (/android/i.test(ua)) so = 'Android';
    else if (/iphone|ipod/i.test(ua)) so = 'iOS';
    else if (/ipad/i.test(ua)) so = 'iPadOS';
    else if (/windows/i.test(ua)) so = 'Windows';
    else if (/mac os x|macintosh/i.test(ua)) so = 'macOS';
    else if (/cros/i.test(ua)) so = 'ChromeOS';
    else if (/linux|x11/i.test(ua)) so = 'Linux';

    let navegador = 'Desconocido';
    if (/edg\//i.test(ua)) navegador = 'Edge';
    else if (/opr\/|opera/i.test(ua)) navegador = 'Opera';
    else if (/samsungbrowser/i.test(ua)) navegador = 'Samsung Internet';
    else if (/firefox|fxios/i.test(ua)) navegador = 'Firefox';
    else if (/chrome|crios/i.test(ua)) navegador = 'Chrome';
    else if (/safari/i.test(ua)) navegador = 'Safari';

    return { so, navegador };
};

/**
 * Guarda (o actualiza) la respuesta de la encuesta.
 * @param {object} datos - payload ya validado por el controller.
 * @returns {Promise<{id: string, duplicada: boolean}>}
 */
const guardarRespuesta = async (datos) => {
    const {
        estado,
        deviceId,
        uidAnonimo,
        uidReal,
        idToken,
        respuestas,
        comentario,
        dispositivo,
        contexto,
        tiempoDeLlenadoSeg,
        intentosDeEnvio,
        honeypot,
        abrioEn,
        ip
    } = datos;

    const id = calcularIdDocumento({ uidAnonimo, deviceId });
    if (!id) {
        throw new Error('Se requiere uidAnonimo o deviceId');
    }

    // Si el token viene y es válido, ya sabemos quién es sin esperar al login.
    const tokenVerificado = await verificarToken(idToken);
    // Un token anónimo NO cuenta como identidad: sólo acredita el dispositivo.
    const token = esTokenAnonimo(tokenVerificado) ? null : tokenVerificado;
    const emailDelToken = token?.email || null;
    const nombreDelToken = token?.name || null;
    const fotoDelToken = token?.picture || null;

    const referencia = db.collection(COLECCION).doc(id);
    const existente = await referencia.get();
    const previo = existente.exists ? existente.data() : null;

    // Una respuesta cerrada NO se puede modificar: las estadísticas se arman con
    // la PRIMERA respuesta enviada y no con la última. Sólo se admite seguir
    // completando algo que había quedado en 'aplazada'.
    if (previo && previo.estado !== 'aplazada') {
        // No se toca ninguna respuesta: únicamente se deja registro del intento,
        // para poder ver después si alguien trató de reenviar o de cambiarla.
        await referencia.set({
            intentosDeCambio: admin.firestore.FieldValue.increment(1),
            ultimoIntentoDeCambioEn: admin.firestore.FieldValue.serverTimestamp(),
            historial: admin.firestore.FieldValue.arrayUnion({
                estado: `intento_sobre_${previo.estado}`,
                fecha: new Date().toISOString(),
                ip: ip || null
            })
        }, { merge: true });

        console.log(`📋 [Encuesta] Ignorada: ${id} ya estaba '${previo.estado}' (no se modifica)`);

        return {
            id,
            estado: previo.estado,
            duplicada: true,
            motivo: `ya_${previo.estado}`
        };
    }

    const uaParseado = parsearUserAgent(dispositivo?.userAgent);
    const segundos = Number.isFinite(Number(tiempoDeLlenadoSeg))
        ? Math.max(0, Math.round(Number(tiempoDeLlenadoSeg)))
        : 0;

    // Señales de que la respuesta podría no ser genuina. Se MARCA, no se descarta:
    // así nunca se pierde un dato real y el filtrado se decide al analizar.
    const honeypotLleno = typeof honeypot === 'string' && honeypot.trim().length > 0;
    const demasiadoRapido = estado !== 'aplazada' && segundos > 0 && segundos < SEGUNDOS_MINIMOS;
    const sospechosa = honeypotLleno || demasiadoRapido;

    // Ojo: serverTimestamp() NO se puede usar dentro de un array en Firestore.
    // Por eso el evento del historial guarda una fecha ISO generada en el servidor.
    const evento = {
        estado,
        fecha: new Date().toISOString(),
        ip: ip || null
    };

    const documento = {
        estado,
        // La versión se fija al crear el registro y no se pisa después: así una
        // respuesta vieja sigue declarando con qué cuestionario se relevó.
        versionCuestionario: previo?.versionCuestionario || VERSION_CUESTIONARIO,
        deviceId: deviceId || null,
        uidAnonimo: uidAnonimo || null,
        uidReal: uidReal || token?.uid || previo?.uidReal || null,

        email: emailDelToken || previo?.email || null,
        // Solo cuenta como verificado si el token lo dice (Google siempre marca
        // email_verified; email/contraseña no, hasta que confirma el correo).
        emailVerificado: token?.email_verified === true || Boolean(previo?.emailVerificado),
        nombre: nombreDelToken || previo?.nombre || null,
        foto: fotoDelToken || previo?.foto || null,

        respuestas: respuestas || previo?.respuestas || {},
        comentario: typeof comentario === 'string' ? comentario : previo?.comentario || '',

        pospusoAntes: Boolean(previo?.pospusoAntes) || estado === 'aplazada',
        intentosDeEnvio: Math.max(Number(intentosDeEnvio) || 0, Number(previo?.intentosDeEnvio) || 0),
        tiempoDeLlenadoSeg: estado === 'aplazada' ? previo?.tiempoDeLlenadoSeg ?? null : segundos,

        dispositivo: {
            so: dispositivo?.so || uaParseado.so,
            navegador: dispositivo?.navegador || uaParseado.navegador,
            pwaInstalada: Boolean(dispositivo?.pwaInstalada),
            pantalla: dispositivo?.pantalla || null,
            userAgent: dispositivo?.userAgent || null
        },
        contexto: {
            zonaHoraria: contexto?.zonaHoraria || null,
            idioma: contexto?.idioma || null,
            plataforma: contexto?.plataforma || null,
            abrioEn: abrioEn || null
        },

        sospechosa,
        senalesDeRiesgo: [
            honeypotLleno ? 'honeypot' : null,
            demasiadoRapido ? 'demasiado_rapido' : null
        ].filter(Boolean),

        ip: ip || null,
        historial: admin.firestore.FieldValue.arrayUnion(evento),
        actualizadoEn: admin.firestore.FieldValue.serverTimestamp()
    };

    if (existente.exists) {
        // merge: solo pisa los campos enviados, el resto del documento queda igual
        // (creadoEn, fecha y el historial acumulado se preservan).
        await referencia.set(documento, { merge: true });
    } else {
        await referencia.set({
            ...documento,
            creadoEn: admin.firestore.FieldValue.serverTimestamp(),
            fecha: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    console.log(
        `📋 [Encuesta] ${existente.exists ? 'Actualizada' : 'Guardada'} -> ${id} | estado=${estado}` +
        `${sospechosa ? ' | ⚠️ MARCADA COMO SOSPECHOSA' : ''}`
    );

    return { id, estado, duplicada: false, actualizada: existente.exists };
};

/**
 * Vincula la respuesta anónima con la cuenta real del usuario.
 * Se llama después de que el usuario se loguea con Google (o con email).
 *
 * @param {object} datos - { deviceId, uidAnonimo, idToken }
 * @returns {Promise<{vinculada: boolean, id: string|null}>}
 */
const vincularRespuesta = async ({ deviceId, uidAnonimo, idToken }) => {
    const token = await verificarToken(idToken);
    if (!token) {
        const error = new Error('Se requiere un ID token válido para vincular la respuesta');
        error.estadoHttp = 401;
        throw error;
    }

    // Con una sesión anónima todavía no hay cuenta real: no se vincula nada.
    if (esTokenAnonimo(token)) {
        console.log('📋 [Encuesta] Token anónimo: todavía no hay cuenta real que vincular');
        return { vinculada: false, id: null, motivo: 'token_anonimo' };
    }

    const id = calcularIdDocumento({ uidAnonimo, deviceId });
    if (!id) {
        return { vinculada: false, id: null };
    }

    const referencia = db.collection(COLECCION).doc(id);
    const existente = await referencia.get();

    if (!existente.exists) {
        // No hay encuesta para este dispositivo: no es un error.
        console.log(`📋 [Encuesta] Sin encuesta que vincular para ${id}`);
        return { vinculada: false, id: null };
    }

    await referencia.set(
        {
            uidReal: token.uid,
            email: token.email || existente.data()?.email || null,
            emailVerificado: token.email_verified === true,
            nombre: token.name || existente.data()?.nombre || null,
            foto: token.picture || existente.data()?.foto || null,
            vinculadaEn: admin.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
    );

    console.log(`🔗 [Encuesta] Respuesta ${id} vinculada a la cuenta ${token.uid} (${token.email || 'sin email'})`);

    return { vinculada: true, id };
};

/** Lee el estado de la encuesta para un dispositivo (útil para diagnóstico). */
const obtenerRespuesta = async (id) => {
    const docId = calcularIdDocumento({ deviceId: id });
    if (!docId) return null;

    const doc = await db.collection(COLECCION).doc(docId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
};

/**
 * Cuántos documentos se leen como máximo para armar el panel.
 * Es una salvaguarda: hoy son cientos, pero evita que algún día el panel
 * intente traer decenas de miles de documentos de una sola vez.
 */
const MAX_DOCUMENTOS_PANEL = 5000;

/** Convierte un Timestamp de Firestore (o un ISO) a ISO; null si no se puede. */
const aIso = (valor) => {
    if (!valor) return null;
    if (typeof valor === 'string') return valor;
    if (typeof valor.toDate === 'function') return valor.toDate().toISOString();
    if (valor instanceof Date) return valor.toISOString();
    return null;
};

/** Redondea a una cantidad fija de decimales (para los porcentajes). */
const redondear = (numero, decimales = 1) => Number(numero.toFixed(decimales));

/** Clasifica el sistema operativo en móvil / escritorio. */
const clasificarDispositivo = (so = '') => {
    if (/android|ios|iphone|ipad/i.test(so)) return 'movil';
    if (/windows|mac|linux|cros/i.test(so)) return 'escritorio';
    return 'desconocido';
};

/**
 * Arma el panel: ficha técnica, distribuciones por pregunta, contexto técnico
 * y la sábana con todas las respuestas.
 *
 * Los porcentajes SIEMPRE se calculan sobre la muestra válida (las completadas):
 * quien cayó en el filtro de exclusión sólo respondió la primera pregunta, así que
 * no puede entrar en el denominador de ninguna distribución.
 */
const obtenerPanelEstadisticas = async () => {
    const snapshot = await db.collection(COLECCION).limit(MAX_DOCUMENTOS_PANEL).get();
    const documentos = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    const total = documentos.length;

    // --- Ficha técnica: cuántos completaron, cuántos cayeron en el filtro y cuántos se fueron
    const porEstado = { completada: 0, excluida: 0, aplazada: 0, otros: 0 };
    for (const doc of documentos) {
        if (Object.prototype.hasOwnProperty.call(porEstado, doc.estado)) {
            porEstado[doc.estado] += 1;
        } else {
            porEstado.otros += 1;
        }
    }

    const completadas = documentos.filter((doc) => doc.estado === 'completada');
    const excluidas = documentos.filter((doc) => doc.estado === 'excluida');
    const aplazadas = documentos.filter((doc) => doc.estado === 'aplazada');

    // --- Identidad: cuántas respuestas de la muestra válida están respaldadas por una cuenta real
    const conCorreo = completadas.filter((doc) => Boolean(doc.email)).length;
    const conCorreoVerificado = completadas.filter(
        (doc) => doc.emailVerificado === true && Boolean(doc.email)
    ).length;

    // --- Controles de calidad
    const sospechosas = documentos.filter((doc) => doc.sospechosa === true).length;
    const conIntentosDeCambio = documentos.filter((doc) => Number(doc.intentosDeCambio) > 0).length;

    // --- Contexto técnico de la muestra válida
    const dispositivo = {
        movil: 0,
        escritorio: 0,
        desconocido: 0,
        pwaInstalada: 0,
        porSo: {},
        porNavegador: {}
    };
    for (const doc of completadas) {
        dispositivo[clasificarDispositivo(doc.dispositivo?.so)] += 1;
        if (doc.dispositivo?.pwaInstalada) dispositivo.pwaInstalada += 1;

        const so = doc.dispositivo?.so || 'Desconocido';
        const navegador = doc.dispositivo?.navegador || 'Desconocido';
        dispositivo.porSo[so] = (dispositivo.porSo[so] || 0) + 1;
        dispositivo.porNavegador[navegador] = (dispositivo.porNavegador[navegador] || 0) + 1;
    }

    // --- Evolución diaria (para mostrar que la muestra creció en el tiempo)
    const mapaDias = new Map();
    for (const doc of documentos) {
        const iso = aIso(doc.creadoEn);
        const dia = iso ? iso.slice(0, 10) : 'sin-fecha';
        const acumulado = mapaDias.get(dia) || { fecha: dia, total: 0, completadas: 0 };
        acumulado.total += 1;
        if (doc.estado === 'completada') acumulado.completadas += 1;
        mapaDias.set(dia, acumulado);
    }
    const porDia = [...mapaDias.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));

    // --- Distribuciones: se recorre lo que hay guardado, sin hardcodear preguntas.
    // Así, si mañana agregás una pregunta, aparece sola en el panel.
    const distribuciones = {};
    for (const doc of completadas) {
        for (const [campo, valor] of Object.entries(doc.respuestas || {})) {
            distribuciones[campo] = distribuciones[campo] || {};
            if (typeof valor !== 'string' || !valor.trim()) continue;
            distribuciones[campo][valor] = (distribuciones[campo][valor] || 0) + 1;
        }
    }

    // --- Versiones del cuestionario presentes en la muestra.
    // Si alguna vez cambia una pregunta, esto avisa si el informe está mezclando
    // respuestas de redacciones distintas.
    const versiones = {};
    for (const doc of documentos) {
        const version = doc.versionCuestionario || 'sin-version';
        versiones[version] = (versiones[version] || 0) + 1;
    }

    // --- Sábana: una fila por respuesta, la más nueva primero
    const listado = documentos
        .map((doc) => ({
            id: doc.id,
            fecha: aIso(doc.creadoEn),
            actualizadoEn: aIso(doc.actualizadoEn),
            estado: doc.estado || 'desconocida',
            versionCuestionario: doc.versionCuestionario || null,
            respuestas: doc.respuestas || {},
            comentario: typeof doc.comentario === 'string' ? doc.comentario : '',
            email: doc.email || null,
            emailVerificado: doc.emailVerificado === true,
            nombre: doc.nombre || null,
            dispositivo: {
                so: doc.dispositivo?.so || null,
                navegador: doc.dispositivo?.navegador || null,
                pwaInstalada: Boolean(doc.dispositivo?.pwaInstalada)
            },
            // Contexto técnico: es parte del origen del dato, no del encuestado.
            contexto: {
                zonaHoraria: doc.contexto?.zonaHoraria || null,
                idioma: doc.contexto?.idioma || null,
                plataforma: doc.contexto?.plataforma || null,
                abrioEn: aIso(doc.contexto?.abrioEn)
            },
            intentosDeCambio: Number(doc.intentosDeCambio) || 0,
            sospechosa: doc.sospechosa === true,
            senalesDeRiesgo: Array.isArray(doc.senalesDeRiesgo) ? doc.senalesDeRiesgo : []
        }))
        .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));

    return {
        generadoEn: new Date().toISOString(),
        versionCuestionario: VERSION_CUESTIONARIO,
        versiones,
        total,
        truncado: total >= MAX_DOCUMENTOS_PANEL,
        estados: porEstado,
        muestra: {
            valida: completadas.length,
            descartadas: excluidas.length,
            abandonos: aplazadas.length,
            // De todos los que abrieron la encuesta, cuántos llegaron al final del flujo.
            tasaFinalizacion: total
                ? redondear(((completadas.length + excluidas.length) / total) * 100)
                : 0
        },
        identidad: {
            conCorreoVerificado,
            conCorreo,
            anonimas: completadas.length - conCorreo,
            porcentajeVerificado: completadas.length
                ? redondear((conCorreoVerificado / completadas.length) * 100)
                : 0
        },
        calidad: { sospechosas, conIntentosDeCambio },
        dispositivo,
        porDia,
        distribuciones,
        listado
    };
};

module.exports = {
    COLECCION,
    ESTADOS_VALIDOS,
    SEGUNDOS_MINIMOS,
    VERSION_CUESTIONARIO,
    MAX_DOCUMENTOS_PANEL,
    guardarRespuesta,
    vincularRespuesta,
    obtenerRespuesta,
    obtenerPanelEstadisticas,
    verificarToken
};
