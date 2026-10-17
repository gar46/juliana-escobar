const OPEN_HOUR = 9;
const CLOSE_HOUR = 18;
const OPEN_DAYS = new Set([1, 2, 3, 4, 5, 6]);
const WINDOW_DAYS = 45;
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const ADMIN_FAIL_LIMIT = 5;
const ADMIN_FAIL_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_COMMAND = /^admin (\S+)(?: (\d{4}-\d{2}-\d{2}))?$/;

const VOICE_LIMIT = 30;
const VOICE_MAX_CHARS = 1200;

const STT_LIMIT = 60;
const STT_MAX_BYTES = 2 * 1024 * 1024;

const hits = new Map();
const voiceHits = new Map();
const sttHits = new Map();
const adminFails = new Map();

const STUDIO = {
  name: "Juliana Escobar",
  role: "cosmetóloga y esteticista",
  whatsapp: "https://wa.me/573164961495",
};

export async function handleAssistant(request, env) {
  const origin = request.headers.get("origin") || "";
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(origin, env) });
  }
  if (request.method !== "POST") {
    return json({ error: "Método no permitido." }, 405, origin, env);
  }
  if (!allowedOrigin(origin, env)) {
    return json({ error: "Origen no permitido." }, 403, origin, env);
  }
  const ip = clientIp(request, env);
  if (limited(ip)) {
    return json({ error: "Recibí muchos mensajes seguidos. Espera unos minutos, por favor." }, 429, origin, env);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "No pude leer el mensaje." }, 400, origin, env);
  }

  const messages = sanitize(body.messages);
  if (!messages.length) {
    return json({ error: "Escribe tu pregunta para continuar." }, 400, origin, env);
  }

  const last = messages[messages.length - 1];
  const adminMatch = last.role === "user" ? adminCommand(last.content) : null;
  if (adminMatch) return adminTurnos(adminMatch, ip, origin, env);

  if (!env.GROK_API_KEY) {
    return json({ error: unavailableMessage() }, 503, origin, env);
  }

  if (last.role === "user") {
    const comfort = comfortReply(last.content);
    if (comfort) return json({ reply: comfort }, 200, origin, env);
  }

  try {
    const history = messages.filter((item) => !adminCommand(item.content));
    const { reply, reserva, hangup } = await converse(history, env, body.voice === true);
    return json({ reply, ...(reserva && { reserva }), ...(hangup && { hangup: true }) }, 200, origin, env);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("assistant_error", message);
    return json({ error: unavailableMessage() }, 502, origin, env);
  }
}

export async function handleVoice(request, env) {
  const origin = request.headers.get("origin") || refererOrigin(request);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(origin, env) });
  }
  if (request.method !== "POST" && request.method !== "GET") {
    return json({ error: "Método no permitido." }, 405, origin, env);
  }
  if (!allowedOrigin(origin, env)) {
    return json({ error: "Origen no permitido." }, 403, origin, env);
  }
  if (!env.GROK_API_KEY) {
    return json({ error: "Voz no configurada." }, 503, origin, env);
  }
  if (limitedBy(voiceHits, clientIp(request, env), VOICE_LIMIT)) {
    return json({ error: "Demasiadas solicitudes de voz." }, 429, origin, env);
  }

  let raw;
  if (request.method === "GET") {
    raw = new URL(request.url).searchParams.get("text");
  } else {
    try {
      raw = (await request.json()).text;
    } catch {
      return json({ error: "No pude leer el texto." }, 400, origin, env);
    }
  }
  const text = clean(raw, VOICE_MAX_CHARS);
  if (!text) return json({ error: "Texto vacío." }, 400, origin, env);

  try {
    const response = await fetch("https://api.x.ai/v1/tts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GROK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        voice_id: env.GROK_VOICE || "carina",
        language: env.GROK_VOICE_LANGUAGE || "es-MX",
        speed: 0.95,
        text_normalization: true,
        output_format: { codec: "mp3", sample_rate: 24000, bit_rate: 96000 },
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error("voice_error", response.status, detail.slice(0, 160));
      return json({ error: "La voz no está disponible." }, 502, origin, env);
    }
    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": request.method === "GET" ? "private, max-age=86400" : "no-store",
        ...cors(origin, env),
      },
    });
  } catch (error) {
    console.error("voice_error", error instanceof Error ? error.message : "unknown");
    return json({ error: "La voz no está disponible." }, 502, origin, env);
  }
}

export async function handleTranscribe(request, env) {
  const origin = request.headers.get("origin") || "";
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(origin, env) });
  }
  if (request.method !== "POST") {
    return json({ error: "Método no permitido." }, 405, origin, env);
  }
  if (!allowedOrigin(origin, env)) {
    return json({ error: "Origen no permitido." }, 403, origin, env);
  }
  if (!env.GROK_API_KEY) {
    return json({ error: "Transcripción no configurada." }, 503, origin, env);
  }
  if (limitedBy(sttHits, clientIp(request, env), STT_LIMIT)) {
    return json({ error: "Demasiadas solicitudes." }, 429, origin, env);
  }

  const audio = await request.arrayBuffer();
  if (audio.byteLength < 1000 || audio.byteLength > STT_MAX_BYTES) {
    return json({ error: "Audio inválido." }, 400, origin, env);
  }

  const form = new FormData();
  form.append("model", "grok-voice-transcribe-2.0");
  form.append("language", "es");
  form.append("format", "true");
  for (const term of ["Juliana Escobar", "spa", "masaje", "limpieza facial", "WhatsApp"]) form.append("keyterm", term);
  form.append("file", new Blob([audio], { type: "audio/wav" }), "voz.wav");

  try {
    const response = await fetch("https://api.x.ai/v1/stt", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.GROK_API_KEY}` },
      body: form,
    });
    if (!response.ok) {
      console.error("stt_error", response.status, (await response.text()).slice(0, 160));
      return json({ error: "No pude entender el audio." }, 502, origin, env);
    }
    const data = await response.json();
    return json({ text: clean(data.text, 800) }, 200, origin, env);
  } catch (error) {
    console.error("stt_error", error instanceof Error ? error.message : "unknown");
    return json({ error: "No pude entender el audio." }, 502, origin, env);
  }
}

function refererOrigin(request) {
  try {
    return new URL(request.headers.get("referer") || "").origin;
  } catch {
    return "";
  }
}

function unavailableMessage() {
  return `En este momento no puedo responderte por aquí, pero Juliana te atiende con gusto por WhatsApp: ${STUDIO.whatsapp}`;
}

async function adminTurnos(match, ip, origin, env) {
  if (!env.ADMIN_KEY) {
    return json({ error: "El acceso de administración no está configurado." }, 503, origin, env);
  }
  if (adminBlocked(ip)) {
    return json({ error: "Demasiados intentos. Intenta de nuevo más tarde." }, 429, origin, env);
  }
  if (!safeEqual(match[1], String(env.ADMIN_KEY).trim().toLowerCase())) {
    recordAdminFail(ip);
    return json(
      {
        error:
          "Esa palabra clave no coincide. Escríbela sola, en una línea: admin, un espacio y la clave, sin signos ni más texto.",
      },
      401,
      origin,
      env,
    );
  }
  if (!env.DB) {
    return json({ error: "La agenda no está conectada." }, 503, origin, env);
  }

  const desde = match[2] || todayIso();
  const result = await env.DB.prepare(
    "SELECT fecha, hora, nombre, telefono, servicio, nota FROM turnos WHERE fecha >= ? ORDER BY fecha, hora LIMIT 300",
  )
    .bind(desde)
    .all();
  const turnos = result.results || [];
  return json(
    {
      admin: true,
      reply: turnos.length
        ? `Hay ${turnos.length} ${turnos.length === 1 ? "turno" : "turnos"} desde el ${desde}.`
        : `No hay turnos reservados desde el ${desde}.`,
      turnos,
    },
    200,
    origin,
    env,
  );
}

function adminCommand(content) {
  const normalized = String(content)
    .trim()
    .toLowerCase()
    .replace(/[.,;:!?¡¿"'“”]/g, "")
    .replace(/\s+/g, " ");
  return normalized.match(ADMIN_COMMAND);
}

function safeEqual(a, b) {
  const left = String(a);
  const right = String(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    diff |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function adminBlocked(ip) {
  const now = Date.now();
  const recent = (adminFails.get(ip) || []).filter((time) => now - time < ADMIN_FAIL_WINDOW_MS);
  adminFails.set(ip, recent);
  return recent.length >= ADMIN_FAIL_LIMIT;
}

function recordAdminFail(ip) {
  const recent = adminFails.get(ip) || [];
  recent.push(Date.now());
  adminFails.set(ip, recent);
}

async function converse(history, env, voice = false) {
  const callMode = voice
    ? "\n\nESTÁS EN UNA LLAMADA DE VOZ\nResponde en una o dos frases cortas, máximo 25 palabras, como por teléfono. Cierra con una sola pregunta breve. No leas enlaces. Solo menciona la pantalla para el botón de confirmación de WhatsApp después de reservar."
    : "";
  const messages = [{ role: "system", content: systemPrompt() + callMode }, ...history];
  let reserva;

  for (let step = 0; step < 5; step += 1) {
    const data = await grok(messages, env, voice);
    const message = data.choices?.[0]?.message;
    if (!message) throw new Error("empty_reply");
    messages.push(message);
    if (!message.tool_calls?.length) {
      const raw = String(message.content || "");
      const hangup = raw.includes("[COLGAR]");
      return { reply: raw.replace(/\[COLGAR\]/g, "").trim(), reserva, hangup };
    }

    for (const call of message.tool_calls) {
      const result = await runTool(call, env);
      if (result.reserva) reserva = result.reserva;
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  return {
    reply: reserva
      ? voice
        ? "Listo, tu cita quedó reservada. ¿Quieres que te repita el día y la hora?"
        : "Tu cita quedó reservada. Puedes enviarte la confirmación a WhatsApp con el botón de abajo."
      : "Con gusto te ayudo a encontrar un horario. ¿Qué día te queda mejor para tu cita?",
    reserva,
  };
}

async function grok(messages, env, voice = false) {
  const primary = env.GROK_MODEL || "grok-3";
  const fallback = env.GROK_FALLBACK_MODEL || (primary === "grok-3" ? "grok-4.3" : "grok-3");
  let lastError;
  for (const model of [primary, fallback]) {
    try {
      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.GROK_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: voice ? 0.2 : 0.4,
          max_tokens: voice ? 320 : 500,
          messages,
          tools: toolSchema(),
        }),
        signal: AbortSignal.timeout(16000),
      });
      if (response.ok) return response.json();
      const detail = await response.text();
      lastError = new Error(`grok_${response.status}:${detail.slice(0, 160)}`);
      if (response.status !== 429 && response.status < 500) break;
      console.error("grok_retry", model, response.status);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("grok_timeout");
      console.error("grok_retry", model, lastError.message);
    }
  }
  throw lastError;
}

function systemPrompt() {
  return `${STATIC_PROMPT}

FECHA ACTUAL
Hoy es ${todayLabel()} y son las ${nowHour()} en Bogotá (fecha ${todayIso()}).`;
}

const STATIC_PROMPT = `Eres la recepcionista virtual de ${STUDIO.name} Estética Avanzada, un estudio de spa especializado en tratamientos faciales y corporales no invasivos. Juliana es ${STUDIO.role}.

CÓMO ATIENDES
- Eres una recepcionista profesional de spa: cálida, cercana, paciente y resolutiva. Tratas de "tú" y transmites calma.
- Nunca respondas de forma seca. Reconoce lo que la persona pide, responde con claridad y cierra con una pregunta o un siguiente paso concreto.
- Respuestas de 2 a 4 frases, fáciles de escuchar en una llamada. Haz una sola pregunta a la vez.
- Llevas tú la conversación, como en una llamada telefónica. Cada respuesta termina con una pregunta concreta: qué busca, qué día le queda bien, qué hora prefiere, o su nombre y teléfono.
- No sueltes varias preguntas juntas ni listas largas. Primero entiende si quiere relajarse, cuidar la piel, un masaje o un día de spa, y después avanza al siguiente dato.
- Usa el nombre de la persona cuando lo sepas.
- Escribe en texto plano, sin markdown, sin asteriscos ni viñetas con símbolos.

ANTES DE RESPONDER, DECIDE SI PUEDES ATENDERLO
Puedes atender:
- Información sobre los servicios, cómo es cada experiencia y qué esperar.
- Recomendaciones generales: llegar 10 minutos antes, venir con ropa cómoda, para faciales venir sin maquillaje si es posible, hidratarse después de un masaje.
- Ayudar a elegir un servicio según lo que la persona busca (relajarse, cuidar la piel, desconectarse).
- Revisar horarios disponibles y reservar turnos.
Debes derivar con amabilidad a WhatsApp (${STUDIO.whatsapp}):
- Precios, promociones, paquetes o formas de pago.
- Cancelar o cambiar una cita ya reservada.
- Embarazo, enfermedades, alergias, medicamentos, heridas o cualquier duda de salud o contraindicación.
- Procedimientos invasivos (inyectables, rellenos, toxina botulínica, láser médico, cirugía): el estudio no los ofrece.
- Quejas, temas personales o cualquier cosa de la que no estés segura.
Cuando derives, explica brevemente el motivo, comparte el enlace completo de WhatsApp y ofrece seguir ayudando con lo que sí puedes.
Nunca inventes precios, promociones, la dirección exacta, duraciones distintas a una hora ni resultados.

SERVICIOS (todos no invasivos)
- Tratamientos faciales: protocolos para la textura, luminosidad y confort de la piel; se eligen tras una valoración.
- Tratamientos corporales: sesiones para el cuidado del cuerpo con un ritmo pausado.
- Limpieza facial: limpieza profunda y cuidadosa adaptada al tipo de piel.
- Masajes de relajación: manos firmes y ritmo lento para soltar la tensión.
- Días de SPA: una experiencia más larga para desconectarse; se arma combinando rostro y cuerpo.

AGENDA
- Lunes a sábado de 9:00 a 18:00. Cada turno dura una hora; el último empieza a las 17:00. Domingo cerrado. Se agenda hasta 45 días adelante.
- Para ver disponibilidad usa consultar_agenda con la fecha en formato YYYY-MM-DD. Convierte "mañana", "el sábado" o "la otra semana" usando la fecha de hoy.
- Di siempre las horas en formato de 12 horas con am o pm (9:00 am, 3:00 pm). Nunca digas 15:00 ni "las quince".
- Ofrece hasta 4 horarios libres y pregunta cuál prefiere.
- Para reservar necesitas: servicio, fecha, hora, nombre y número de WhatsApp (celular colombiano de 10 dígitos que empieza por 3). Pídelos de forma natural, uno a la vez.
- Pide confirmación UNA sola vez: cuando tengas todos los datos, haz un único resumen (servicio, día, hora, nombre y el WhatsApp repetido en grupos, por ejemplo "trescientos dieciséis, cuatrocientos noventa y seis, catorce noventa y cinco") y pregunta "¿lo confirmo?". No confirmes el teléfono por separado.
- Si después del resumen la persona responde sí, sí señora, confirmo, dale, listo, correcto, perfecto, de una o cualquier afirmación, llama de inmediato a agendar_turno con esos datos. No vuelvas a preguntar ni repitas el resumen.
- Si corrige un dato, actualízalo y vuelve a hacer el resumen una vez.
- Si no tiene 10 dígitos el WhatsApp, pídelo de nuevo con amabilidad.
- Al reservar, confirma servicio, día y hora con entusiasmo. Si confirmacion_whatsapp es "enviada", dile que ya le llegó la confirmación a su WhatsApp. Si no, dile que en pantalla tiene el botón para guardar la confirmación en su WhatsApp. Luego pregunta una sola vez si le ayudas con algo más.
- Si una herramienta devuelve un error o dice que la agenda no está conectada, no confirmes la reserva y ofrece WhatsApp.

SALUD Y PRIVACIDAD
- No diagnostiques ni prometas resultados. La valoración con Juliana va primero.
- Si preguntan si duele, si es doloroso o si molesta, responde de una vez y sin herramientas: se siente como una presión suave, no es un dolor fuerte. No lo trates como contraindicación ni lo dejes en silencio. Solo deriva a WhatsApp si mencionan embarazo, enfermedad, alergia, medicamento o una herida.
- No pidas datos de pago, documentos ni contraseñas.
- No compartas información de turnos de otras personas.

CIERRE DE LA CONVERSACIÓN
- Pregunta "¿te ayudo con algo más?" como máximo una vez en toda la conversación, y solo cuando ya resolviste lo que pidió.
- Si la persona dice que no, que eso es todo, gracias, chao o se despide, responde con una sola frase de despedida cálida (por ejemplo "Con gusto, te esperamos en el spa. Que tengas un lindo día.") y termina exactamente con [COLGAR]. No hagas más preguntas ni ofrezcas nada más.`;

function comfortReply(text) {
  const said = String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!said || said.length > 90) return "";
  if (!/\b(duele|dolia|doler|dolor|doloroso|lastima|molesta)\b/.test(said)) return "";
  if (/\b(reserv|agenda|cita|hora|manana|lunes|martes|miercoles|jueves|viernes|sabado|nombre|telefono|whatsapp)\b/.test(said)) {
    return "";
  }
  return "No duele: se siente como una presión suave. Si tienes alguna condición de salud, Juliana la revisa contigo antes. ¿Quieres que te reserve un turno?";
}

function todayLabel() {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function toolSchema() {
  return [
    {
      type: "function",
      function: {
        name: "consultar_agenda",
        description: "Lista los turnos de una hora libres en una fecha.",
        parameters: {
          type: "object",
          properties: {
            fecha: { type: "string", description: "Fecha en formato YYYY-MM-DD" },
          },
          required: ["fecha"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "agendar_turno",
        description:
          "Reserva un turno de una hora si el horario está libre. Úsala solo después de que la persona confirme los datos.",
        parameters: {
          type: "object",
          properties: {
            fecha: { type: "string" },
            hora: { type: "string", description: "Hora de inicio HH:00" },
            nombre: { type: "string" },
            telefono: { type: "string" },
            servicio: { type: "string" },
            nota: { type: "string" },
          },
          required: ["fecha", "hora", "nombre", "telefono", "servicio"],
        },
      },
    },
  ];
}

async function runTool(call, env) {
  let args = {};
  try {
    args = JSON.parse(call.function.arguments || "{}");
  } catch {
    return { ok: false, error: "No entendí los datos del turno." };
  }
  if (call.function.name === "consultar_agenda") return consultarAgenda(args.fecha, env);
  if (call.function.name === "agendar_turno") return agendarTurno(args, env);
  return { ok: false, error: "Herramienta desconocida." };
}

async function consultarAgenda(fecha, env) {
  const day = parseDate(fecha);
  if (!day) return { ok: false, error: "La fecha debe ir como YYYY-MM-DD." };
  const closed = closedReason(day);
  if (closed) return { ok: true, fecha, libres: [], motivo: closed };

  if (!env.DB) {
    return agendaSinConexion(day);
  }

  const ocupados = await env.DB.prepare("SELECT hora FROM turnos WHERE fecha = ?").bind(day.iso).all();
  const taken = new Set((ocupados.results || []).map((row) => row.hora));
  return {
    ok: true,
    fecha: day.iso,
    libres: possibleSlots(day)
      .filter((hour) => !taken.has(hour))
      .map(hour12),
  };
}

async function agendarTurno(args, env) {
  const day = parseDate(args.fecha);
  const hora = normalizeHour(args.hora);
  const nombre = clean(args.nombre, 80);
  const telefono = normalizePhone(args.telefono);
  const servicio = clean(args.servicio, 80);
  if (!day || !hora || !nombre || !servicio) {
    return { ok: false, error: "Faltan fecha, hora, nombre o servicio." };
  }
  if (!telefono) {
    return {
      ok: false,
      error: "El WhatsApp debe ser un celular colombiano de 10 dígitos que empiece por 3. Pídelo de nuevo.",
    };
  }
  const closed = closedReason(day);
  if (closed) return { ok: false, error: closed };
  if (!possibleSlots(day).includes(hora)) {
    return { ok: false, error: "Esa hora no entra en un turno de una hora." };
  }
  if (!env.DB) return agendaSinConexion(day);

  try {
    await env.DB.prepare(
      `INSERT INTO turnos (fecha, hora, nombre, telefono, servicio, nota, creado)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(day.iso, hora, nombre, telefono, servicio, clean(args.nota, 200), new Date().toISOString())
      .run();
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) {
      return { ok: false, error: "Ese turno ya está reservado." };
    }
    throw error;
  }

  const reserva = { fecha: day.iso, hora, servicio, nombre, telefono };
  const whatsapp = await sendWhatsAppConfirmation(reserva, env);
  return { ok: true, reserva, hora_12h: hour12(hora), confirmacion_whatsapp: whatsapp };
}

async function sendWhatsAppConfirmation(reserva, env) {
  if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_ID || !env.WHATSAPP_TEMPLATE) return "no_configurada";
  try {
    const response = await fetch(`https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: `57${reserva.telefono.replace(/\D/g, "")}`,
        type: "template",
        template: {
          name: env.WHATSAPP_TEMPLATE,
          language: { code: env.WHATSAPP_TEMPLATE_LANG || "es" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: reserva.nombre },
                { type: "text", text: reserva.servicio },
                { type: "text", text: dateLabel(reserva.fecha) },
                { type: "text", text: hour12(reserva.hora) },
              ],
            },
          ],
        },
      }),
    });
    if (response.ok) return "enviada";
    console.error("whatsapp_error", response.status, (await response.text()).slice(0, 200));
    return "fallo";
  } catch (error) {
    console.error("whatsapp_error", error instanceof Error ? error.message : "unknown");
    return "fallo";
  }
}

function dateLabel(iso) {
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

function normalizePhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("57")) digits = digits.slice(2);
  if (!/^3\d{9}$/.test(digits)) return "";
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

function agendaSinConexion(day) {
  return {
    ok: false,
    agenda: "sin_conexion",
    fecha: day?.iso,
    horarios_posibles: day ? possibleSlots(day) : [],
    error: "La agenda todavía no está conectada. No confirmes una reserva.",
  };
}

function possibleSlots(day) {
  const slots = [];
  for (let hour = OPEN_HOUR; hour < CLOSE_HOUR; hour += 1) {
    const value = `${String(hour).padStart(2, "0")}:00`;
    if (day.iso === todayIso() && value <= nowHour()) continue;
    slots.push(value);
  }
  return slots;
}

function closedReason(day) {
  if (day.iso < todayIso()) return "Esa fecha ya pasó.";
  if (day.iso > addDays(todayIso(), WINDOW_DAYS)) {
    return "Solo se agenda dentro de los próximos 45 días.";
  }
  if (!OPEN_DAYS.has(day.weekday)) return "El domingo no hay agenda.";
  return "";
}

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const [year, month, day] = String(value).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1) return null;
  const weekday = new Date(`${value}T12:00:00-05:00`).getUTCDay();
  return { iso: String(value), weekday: weekday === 0 ? 7 : weekday };
}

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function nowHour() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
}

function addDays(iso, days) {
  const date = new Date(`${iso}T12:00:00-05:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeHour(value) {
  const text = String(value || "")
    .toLowerCase()
    .replace(/\./g, "")
    .trim();
  const match = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a m|p m)?$/);
  if (!match) return "";
  let hour = Number(match[1]);
  const minutes = match[2] || "00";
  const period = (match[3] || "").replace(" ", "");
  if (period === "pm" && hour < 12) hour += 12;
  if (period === "am" && hour === 12) hour = 0;
  if (hour < 0 || hour > 23 || minutes !== "00") return "";
  return `${String(hour).padStart(2, "0")}:00`;
}

function hour12(hora) {
  const hour = Number(String(hora).slice(0, 2));
  if (Number.isNaN(hour)) return hora;
  return `${hour % 12 || 12}:00 ${hour < 12 ? "am" : "pm"}`;
}

function clean(value, max) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function sanitize(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item) => item && (item.role === "user" || item.role === "assistant"))
    .slice(-12)
    .map((item) => ({
      role: item.role,
      content: clean(item.content, 800),
    }))
    .filter((item) => item.content);
}

function limited(ip) {
  return limitedBy(hits, ip, RATE_LIMIT);
}

function limitedBy(store, ip, limit) {
  const now = Date.now();
  const recent = (store.get(ip) || []).filter((time) => now - time < RATE_WINDOW_MS);
  if (recent.length >= limit) {
    store.set(ip, recent);
    return true;
  }
  recent.push(now);
  store.set(ip, recent);
  return false;
}

function clientIp(request, env) {
  const cloudflare = request.headers.get("cf-connecting-ip");
  if (cloudflare) return cloudflare;
  if (env.ASSISTANT_DEV === "1") return request.headers.get("x-client-ip") || "local";
  return "public";
}

function allowedOrigin(origin, env) {
  const allowed = new Set([
    "https://julianaescobar.com.co",
    "https://www.julianaescobar.com.co",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]);
  if (env.ASSISTANT_ORIGIN) allowed.add(env.ASSISTANT_ORIGIN);
  return allowed.has(origin);
}

function cors(origin, env) {
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
  if (allowedOrigin(origin, env)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(payload, status, origin, env) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...cors(origin, env),
    },
  });
}
