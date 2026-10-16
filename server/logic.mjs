const OPEN_HOUR = 9;
const CLOSE_HOUR = 18;
const OPEN_DAYS = new Set([1, 2, 3, 4, 5, 6]);
const WINDOW_DAYS = 45;
const RATE_LIMIT = 12;
const RATE_WINDOW_MS = 10 * 60 * 1000;

const hits = new Map();

const STUDIO = {
  name: "Juliana Escobar",
  role: "cosmetóloga y esteticista",
  phone: "316 496 1495",
  whatsapp: "https://wa.me/573164961495",
  services: [
    "Tratamientos faciales",
    "Tratamientos corporales",
    "Limpieza facial",
    "Masajes de relajación",
    "Días de SPA",
  ],
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
  if (!env.GROK_API_KEY) {
    return json(
      { error: "El asistente todavía no tiene configurada la conexión." },
      503,
      origin,
      env,
    );
  }
  if (limited(clientIp(request, env))) {
    return json({ error: "Demasiados mensajes. Espera unos minutos." }, 429, origin, env);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "No pude leer el mensaje." }, 400, origin, env);
  }

  const messages = sanitize(body.messages);
  if (!messages.length) {
    return json({ error: "Escribe una pregunta para continuar." }, 400, origin, env);
  }

  try {
    const reply = await converse(messages, env);
    return json({ reply }, 200, origin, env);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("assistant_error", message);
    return json(
      { error: "No pude responder ahora. Puedes escribir por WhatsApp al 316 496 1495." },
      502,
      origin,
      env,
    );
  }
}

async function converse(history, env) {
  const messages = [{ role: "system", content: systemPrompt() }, ...history];

  for (let step = 0; step < 4; step += 1) {
    const data = await grok(messages, env);
    const message = data.choices?.[0]?.message;
    if (!message) throw new Error("empty_reply");
    messages.push(message);
    if (!message.tool_calls?.length) return String(message.content || "").trim();

    for (const call of message.tool_calls) {
      const result = await runTool(call, env);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  return "Puedo ayudarte con horarios y con un turno de una hora. ¿Qué día te queda bien?";
}

async function grok(messages, env) {
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GROK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.GROK_MODEL || "grok-3",
      temperature: 0.4,
      messages,
      tools: toolSchema(),
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`grok_${response.status}:${detail.slice(0, 160)}`);
  }
  return response.json();
}

function systemPrompt() {
  return [
    `Eres el asistente de ${STUDIO.name}, ${STUDIO.role}, en su web.`,
    "Respondes en español, con frases cortas y un tono cálido.",
    "Ayudas con los servicios, los horarios y a reservar turnos de una hora.",
    `Servicios: ${STUDIO.services.join(", ")}.`,
    "La agenda es de lunes a sábado, de 9:00 a 18:00, hora de Bogotá. Cada turno ocupa una hora. El último turno empieza a las 17:00. El domingo no hay agenda.",
    "No prometas resultados médicos ni digas que un tratamiento sirve para todas las pieles. La valoración va primero.",
    "No inventes la dirección: se confirma al agendar.",
    "Para consultar disponibilidad usa la herramienta consultar_agenda. Para reservar usa agendar_turno solo cuando tengas nombre, teléfono, servicio, fecha y hora.",
    "Si una herramienta responde que la agenda no está conectada, no confirmes la reserva. Ofrece WhatsApp " +
      STUDIO.phone +
      ".",
    "No pidas ni repitas claves, contraseñas ni datos de pago.",
  ].join(" ");
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
        description: "Reserva un turno de una hora si el horario está libre.",
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
    libres: possibleSlots(day).filter((hour) => !taken.has(hour)),
  };
}

async function agendarTurno(args, env) {
  const day = parseDate(args.fecha);
  const hora = normalizeHour(args.hora);
  const nombre = clean(args.nombre, 80);
  const telefono = clean(args.telefono, 30);
  const servicio = clean(args.servicio, 80);
  if (!day || !hora || !nombre || !telefono || !servicio) {
    return { ok: false, error: "Faltan fecha, hora, nombre, teléfono o servicio." };
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

  return { ok: true, fecha: day.iso, hora, servicio };
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
  const match = String(value || "").match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!match) return "";
  const hour = Number(match[1]);
  const minutes = match[2] || "00";
  if (hour < 0 || hour > 23 || minutes !== "00") return "";
  return `${String(hour).padStart(2, "0")}:00`;
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
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((time) => now - time < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
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
    headers: { "Content-Type": "application/json", ...cors(origin, env) },
  });
}
