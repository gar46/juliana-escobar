import { FormEvent, Fragment, useCallback, useEffect, useId, useRef, useState } from "react";
import { CalendarDays, PenLine, Phone, PhoneCall, Send, Volume2, X } from "lucide-react";
import { OPEN_ASSISTANT_EVENT } from "../assistantBus";
import { site, whatsappUrl } from "../content";

type Turno = {
  fecha: string;
  hora: string;
  nombre: string;
  telefono: string;
  servicio: string;
  nota?: string;
};

type Reserva = {
  fecha: string;
  hora: string;
  servicio: string;
  nombre: string;
  telefono: string;
};

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
  private?: boolean;
  turnos?: Turno[];
  reserva?: Reserva;
};

type AssistantResponse = {
  reply?: string;
  error?: string;
  hangup?: boolean;
  admin?: boolean;
  turnos?: Turno[];
  reserva?: Reserva;
};

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };

type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
};

type RecognitionConstructor = new () => Recognition;

const greeting: ChatMessage = {
  role: "assistant",
  content:
    "¡Hola! Bienvenida a Juliana Escobar Estética Avanzada. Soy tu recepcionista virtual: te cuento sobre nuestros faciales, masajes y días de spa, reviso horarios y te ayudo a reservar tu turno. ¿En qué te puedo ayudar hoy?",
};

const endpoint =
  import.meta.env.VITE_ASSISTANT_URL ||
  (import.meta.env.DEV
    ? "/api/assistant"
    : "https://juliana-asistente.juliana-escobar.workers.dev/api/assistant");

const voiceEndpoint = endpoint.replace(/assistant$/, "voice");
const SILENCE_MS = 1100;
const FILLER_DELAY_MS = 1300;
const FILLERS = ["Un momento, ya te digo.", "Déjame revisar.", "Claro, un segundo."];
const FAREWELL = "Con gusto, te esperamos en el spa. Que tengas un lindo día.";

function voiceUrl(text: string) {
  return `${voiceEndpoint}?text=${encodeURIComponent(text)}`;
}

function normalized(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const GOODBYE =
  /^(no )?(muchas )?(gracias )?(eso es todo|eso seria todo|nada mas|chao|chau|adios|hasta luego|hasta pronto|bye|nos vemos)( gracias| muchas gracias| chao| adios)*$/;
const DECLINE = /^(no|no gracias|no muchas gracias|no senora|no senorita|gracias|muchas gracias|no por ahora|por ahora no)$/;

function isGoodbye(text: string, lastAssistant: string) {
  const said = normalized(text);
  if (GOODBYE.test(said)) return true;
  return DECLINE.test(said) && /algo mas|otra cosa|ayudarte en algo|ayudo con algo/.test(normalized(lastAssistant));
}

type CallMode = "speaker" | "ear" | "write";

const ADMIN_PATTERN = /^\s*admin\s+\S+/i;
const URL_PATTERN = /(https?:\/\/[^\s)]+)/g;

function recognitionConstructor(): RecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const speech = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return speech.SpeechRecognition || speech.webkitSpeechRecognition;
}

function voiceScore(voice: SpeechSynthesisVoice) {
  const lang = voice.lang.toLowerCase();
  if (!lang.startsWith("es")) return -1;
  const name = `${voice.name} ${voice.voiceURI}`.toLowerCase();
  let score = lang === "es-co" ? 40 : lang === "es-mx" ? 32 : 18;
  if (/natural|neural|online|premium|wavenet|studio/.test(name)) score += 80;
  if (/google/.test(name)) score += 28;
  if (/salome|dalia|paulina/.test(name)) score += 12;
  if (voice.localService && /desktop|sabina|helena/.test(name) && !/natural|neural/.test(name)) score -= 25;
  return score;
}

function pickVoice() {
  let best: SpeechSynthesisVoice | undefined;
  let bestScore = -1;
  for (const voice of window.speechSynthesis.getVoices()) {
    const score = voiceScore(voice);
    if (score > bestScore) {
      best = voice;
      bestScore = score;
    }
  }
  return best;
}

function speakable(text: string) {
  return text.replace(URL_PATTERN, "el enlace de WhatsApp");
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

function absorb(current: string, piece: string) {
  const next = piece.replace(/\s+/g, " ").trim();
  const base = current.replace(/\s+/g, " ").trim();
  if (!next) return base;
  if (!base) return next;
  const left = base.toLowerCase();
  const right = next.toLowerCase();
  if (right.startsWith(left) || left.startsWith(right)) return right.length >= left.length ? next : base;
  const limit = Math.min(left.length, right.length);
  for (let size = limit; size >= 4; size -= 1) {
    if (left.endsWith(right.slice(0, size))) return `${base}${next.slice(size)}`.replace(/\s+/g, " ").trim();
  }
  return `${base} ${next}`.trim();
}

function transcriptOf(results: ArrayLike<RecognitionResult>) {
  let text = "";
  for (let index = 0; index < results.length; index += 1) {
    text = absorb(text, results[index][0]?.transcript || "");
  }
  return text;
}

function collapseStutter(text: string) {
  let value = text.replace(/\s+/g, " ").trim();
  let previous = "";
  while (value !== previous) {
    previous = value;
    value = value.replace(/([\p{L}\d]+(?:\s+[\p{L}\d]+){0,6})\s+\1/giu, "$1");
  }
  return value;
}

function spokenHour(hora: string) {
  const hour = Number(hora.slice(0, 2));
  if (Number.isNaN(hour)) return hora;
  const twelve = hour % 12 || 12;
  const part = hour < 12 ? "de la mañana" : hour < 19 ? "de la tarde" : "de la noche";
  return `${twelve === 1 ? "la una" : `las ${twelve}`} ${part}`;
}

function agendaSpeech(reply: string, turnos: Turno[]) {
  if (!turnos.length) return reply;
  const byDate = turnos.reduce<Record<string, Turno[]>>((groups, turno) => {
    (groups[turno.fecha] ||= []).push(turno);
    return groups;
  }, {});
  const days = Object.entries(byDate).map(([fecha, items]) => {
    const list = items.map((turno) => `a ${spokenHour(turno.hora)}, ${turno.nombre}, ${turno.servicio}`).join(". ");
    return `El ${formatDate(fecha)}: ${list}.`;
  });
  return `${reply} ${days.join(" ")}`;
}

function confirmationText(reserva: Reserva) {
  return [
    `Confirmación de cita – ${site.name}`,
    `Nombre: ${reserva.nombre}`,
    `Servicio: ${reserva.servicio}`,
    `Fecha: ${formatDate(reserva.fecha)}`,
    `Hora: ${reserva.hora}`,
    `WhatsApp: ${reserva.telefono}`,
    "Duración: 1 hora. La dirección se confirma por este medio.",
  ].join("\n");
}

function ReservaCard({ reserva }: { reserva: Reserva }) {
  const text = encodeURIComponent(confirmationText(reserva));
  const clientNumber = `57${reserva.telefono.replace(/\D/g, "")}`;
  const studioNumber = whatsappUrl.replace(/\D/g, "");
  return (
    <div className="reserva-card">
      <dl>
        <div>
          <dt>Servicio</dt>
          <dd>{reserva.servicio}</dd>
        </div>
        <div>
          <dt>Fecha</dt>
          <dd>{formatDate(reserva.fecha)}</dd>
        </div>
        <div>
          <dt>Hora</dt>
          <dd>{reserva.hora}</dd>
        </div>
        <div>
          <dt>WhatsApp</dt>
          <dd>{reserva.telefono}</dd>
        </div>
      </dl>
      <a className="reserva-card__primary" href={`https://wa.me/${clientNumber}?text=${text}`} target="_blank" rel="noreferrer">
        Guardar confirmación en mi WhatsApp
      </a>
      <a href={`https://wa.me/${studioNumber}?text=${text}`} target="_blank" rel="noreferrer">
        Avisar a Juliana por WhatsApp
      </a>
    </div>
  );
}

function MessageText({ text }: { text: string }) {
  const parts = text.split(URL_PATTERN);
  return (
    <>
      {parts.map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a key={index} href={part} target="_blank" rel="noreferrer">
            {part.includes("wa.me") ? "Escribir por WhatsApp" : part}
          </a>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function AdminList({ turnos }: { turnos: Turno[] }) {
  const byDate = turnos.reduce<Record<string, Turno[]>>((groups, turno) => {
    (groups[turno.fecha] ||= []).push(turno);
    return groups;
  }, {});

  return (
    <div className="admin-list">
      {Object.entries(byDate).map(([fecha, items]) => (
        <section key={fecha}>
          <h4>{formatDate(fecha)}</h4>
          <ul>
            {items.map((turno) => (
              <li key={`${turno.fecha}-${turno.hora}`}>
                <strong>{turno.hora}</strong>
                <div>
                  <p>{turno.nombre}</p>
                  <span>{turno.servicio}</span>
                  <a href={`tel:${turno.telefono.replace(/[^\d+]/g, "")}`}>{turno.telefono}</a>
                  {turno.nota && <em>{turno.nota}</em>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function Assistant() {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const sessionRef = useRef(0);
  const closeRef = useRef<() => void>(() => {});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fillerRef = useRef<HTMLAudioElement | null>(null);
  const fillerTimerRef = useRef<number | undefined>(undefined);
  const hangupRef = useRef(false);
  const grokVoiceFailedAt = useRef(0);
  const heardRef = useRef("");
  const carriedRef = useRef("");
  const silenceRef = useRef<number | undefined>(undefined);
  const controls = useRef({ open: false, pending: false, speaking: false, wantMic: true, mode: "speaker" as CallMode });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [listening, setListening] = useState(false);
  const [mode, setMode] = useState<CallMode>("speaker");
  const [messages, setMessages] = useState<ChatMessage[]>([greeting]);
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

  controls.current.open = open;
  controls.current.mode = mode;

  const beginListeningRef = useRef<() => void>(() => {});
  const resumeMic = useCallback((delay = 400) => {
    window.setTimeout(() => {
      const state = controls.current;
      if (state.open && state.wantMic && !state.speaking && !state.pending) beginListeningRef.current();
    }, delay);
  }, []);

  const stopListening = useCallback(() => {
    window.clearTimeout(silenceRef.current);
    heardRef.current = "";
    carriedRef.current = "";
    sessionRef.current += 1;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    try {
      recognition?.stop();
    } catch {
      /* ya estaba detenido */
    }
    setListening(false);
  }, []);

  const beginListening = useCallback(() => {
    const Constructor = recognitionConstructor();
    const state = controls.current;
    if (!Constructor || !state.open || !state.wantMic || state.speaking || state.pending) return;
    sessionRef.current += 1;
    const session = sessionRef.current;
    const previous = recognitionRef.current;
    recognitionRef.current = null;
    try {
      previous?.stop();
    } catch {
      /* ya estaba detenido */
    }
    const flush = () => {
      window.clearTimeout(silenceRef.current);
      const spoken = collapseStutter(heardRef.current);
      heardRef.current = "";
      carriedRef.current = "";
      if (!spoken || controls.current.pending) return false;
      setDraft("");
      stopListening();
      void sendRef.current(spoken);
      return true;
    };
    const carried = carriedRef.current;
    const recognition = new Constructor();
    recognition.lang = "es-CO";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      heardRef.current = absorb(carried, transcriptOf(event.results));
      if (controls.current.mode === "write") setDraft(heardRef.current);
      window.clearTimeout(silenceRef.current);
      silenceRef.current = window.setTimeout(() => {
        if (heardRef.current.trim()) flush();
      }, controls.current.mode === "write" ? 2200 : SILENCE_MS);
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        controls.current.wantMic = false;
        setListening(false);
      }
    };
    recognition.onend = () => {
      if (sessionRef.current !== session) return;
      carriedRef.current = heardRef.current;
      setListening(false);
      resumeMic(250);
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [resumeMic, stopListening]);

  const stopSpeaking = useCallback(() => {
    controls.current.speaking = false;
    audioRef.current?.pause();
    audioRef.current = null;
    if (canSpeak) window.speechSynthesis.cancel();
  }, [canSpeak]);

  const finishSpeaking = useCallback(() => {
    controls.current.speaking = false;
    audioRef.current = null;
    if (hangupRef.current) {
      hangupRef.current = false;
      window.setTimeout(() => closeRef.current(), 300);
      return;
    }
    resumeMic(450);
  }, [resumeMic]);

  const speakWithBrowser = useCallback(
    (text: string) => {
      if (!canSpeak) {
        finishSpeaking();
        return;
      }
      const voice = pickVoice();
      const parts = speakable(text)
        .split(/(?<=[.!?])\s+/)
        .map((part) => part.trim())
        .filter(Boolean);
      let index = 0;
      const next = () => {
        if (!controls.current.speaking) return;
        if (index >= parts.length) {
          finishSpeaking();
          return;
        }
        const utterance = new SpeechSynthesisUtterance(parts[index]);
        index += 1;
        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang;
        } else {
          utterance.lang = "es-CO";
        }
        utterance.rate = 0.93;
        utterance.pitch = 1.03;
        utterance.volume = controls.current.mode === "speaker" ? 1 : 0.45;
        utterance.onend = next;
        utterance.onerror = next;
        window.speechSynthesis.speak(utterance);
      };
      next();
      window.speechSynthesis.resume();
    },
    [canSpeak, finishSpeaking],
  );

  const stopFiller = useCallback(() => {
    window.clearTimeout(fillerTimerRef.current);
    fillerRef.current?.pause();
    fillerRef.current = null;
  }, []);

  const speak = useCallback(
    (text: string) => {
      stopFiller();
      if (controls.current.mode === "write") return;
      stopSpeaking();
      controls.current.speaking = true;
      stopListening();
      const spoken = speakable(text);

      if (Date.now() - grokVoiceFailedAt.current < 5 * 60 * 1000) {
        speakWithBrowser(spoken);
        return;
      }
      const audio = new Audio(voiceUrl(spoken));
      audio.volume = controls.current.mode === "speaker" ? 1 : 0.45;
      audioRef.current = audio;
      let started = false;
      const fail = () => {
        if (audioRef.current !== audio) return;
        audioRef.current = null;
        if (started) {
          finishSpeaking();
          return;
        }
        grokVoiceFailedAt.current = Date.now();
        if (controls.current.speaking) speakWithBrowser(spoken);
      };
      audio.onplaying = () => {
        started = true;
      };
      audio.onended = () => {
        if (audioRef.current === audio) finishSpeaking();
      };
      audio.onerror = fail;
      audio.play().catch(fail);
    },
    [finishSpeaking, speakWithBrowser, stopFiller, stopListening, stopSpeaking],
  );

  const startFiller = useCallback(() => {
    if (controls.current.mode === "write") return;
    window.clearTimeout(fillerTimerRef.current);
    fillerTimerRef.current = window.setTimeout(() => {
      if (!controls.current.pending || controls.current.speaking) return;
      const filler = new Audio(voiceUrl(FILLERS[Math.floor(Math.random() * FILLERS.length)]));
      filler.volume = controls.current.mode === "speaker" ? 0.9 : 0.4;
      fillerRef.current = filler;
      filler.play().catch(() => undefined);
    }, FILLER_DELAY_MS);
  }, []);

  beginListeningRef.current = beginListening;
  const sendRef = useRef<(text: string) => Promise<void>>(async () => {});

  useEffect(() => {
    if (!canSpeak) return;
    window.speechSynthesis.getVoices();
    const load = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [canSpeak]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    const log = logRef.current;
    if (!log) return;
    const last = log.lastElementChild as HTMLElement | null;
    if (!last) return;
    const lastIsAssistant = last.classList.contains("assistant__msg--assistant");
    const top = lastIsAssistant ? last.offsetTop - 12 : log.scrollHeight;
    log.scrollTo({ top, behavior: "smooth" });
  }, [messages, pending, open]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || controls.current.pending) return;
    stopListening();
    const isPrivate = ADMIN_PATTERN.test(content);
    const userMessage: ChatMessage = { role: "user", content, private: isPrivate };
    const next = [...messages, userMessage];
    setDraft("");

    const lastAssistant = [...messages].reverse().find((item) => item.role === "assistant")?.content || "";
    if (messages.length > 1 && !isPrivate && isGoodbye(content, lastAssistant)) {
      setMessages([...next, { role: "assistant", content: FAREWELL }]);
      hangUpAfterReply();
      speak(FAREWELL);
      return;
    }

    controls.current.pending = true;
    setMessages(next);
    setPending(true);
    startFiller();

    const history = next
      .filter((item) => item !== greeting && !item.turnos && (!item.private || item === userMessage))
      .map(({ role, content: body }) => ({ role, content: body }));

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: isPrivate ? [history[history.length - 1]] : history,
          voice: controls.current.mode !== "write" && !isPrivate,
        }),
      });
      const data = (await response.json()) as AssistantResponse;
      const reply =
        data.reply ||
        data.error ||
        `No pude responder ahora. Puedes escribirnos por WhatsApp: ${whatsappUrl}`;
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: reply,
          turnos: data.admin ? data.turnos || [] : undefined,
          reserva: data.reserva,
        },
      ]);
      controls.current.pending = false;
      if (data.hangup) hangUpAfterReply();
      speak(data.admin ? agendaSpeech(reply, data.turnos || []) : reply);
    } catch {
      const reply = `No pude conectarme en este momento. Escríbenos por WhatsApp y te atendemos enseguida: ${whatsappUrl}`;
      setMessages((current) => [...current, { role: "assistant", content: reply }]);
      controls.current.pending = false;
      speak(reply);
    } finally {
      stopFiller();
      controls.current.pending = false;
      setPending(false);
      if (!controls.current.speaking && !hangupRef.current) resumeMic();
    }
  }

  function hangUpAfterReply() {
    if (controls.current.mode === "write") {
      window.setTimeout(() => closeRef.current(), 2500);
      return;
    }
    hangupRef.current = true;
  }

  sendRef.current = send;

  function closeAssistant() {
    controls.current.open = false;
    controls.current.wantMic = false;
    hangupRef.current = false;
    setOpen(false);
    stopListening();
    stopFiller();
    stopSpeaking();
    setListening(false);
  }

  closeRef.current = closeAssistant;

  function openAssistant() {
    if (controls.current.open) return;
    stopListening();
    stopSpeaking();
    controls.current.open = true;
    controls.current.wantMic = true;
    controls.current.pending = false;
    controls.current.mode = "speaker";
    hangupRef.current = false;
    for (const filler of FILLERS) {
      const preload = new Audio();
      preload.preload = "auto";
      preload.src = voiceUrl(filler);
    }
    setMode("speaker");
    setMessages([greeting]);
    setDraft("");
    setPending(false);
    setOpen(true);
    void speak("Hola, soy la recepción de Juliana Escobar. ¿Buscas un facial, un masaje o un día de spa?");
  }

  const openRef = useRef(openAssistant);
  openRef.current = openAssistant;

  useEffect(() => {
    const onOpen = () => openRef.current();
    window.addEventListener(OPEN_ASSISTANT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_ASSISTANT_EVENT, onOpen);
  }, []);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(draft);
  }

  function chooseMode(next: CallMode) {
    if (next === mode) return;
    controls.current.mode = next;
    setMode(next);
    if (next === "write") {
      controls.current.wantMic = false;
      stopSpeaking();
      stopListening();
      setDraft("");
      return;
    }
    controls.current.wantMic = true;
    void speak(next === "ear" ? "Te escucho. Acerca el celular a tu oreja." : "Te escucho en altavoz.");
  }

  return (
    <>
      {open && (
        <section
          className="assistant"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <header className="assistant__bar">
            <div>
              <p id={titleId}>Recepción</p>
              <span>
                {mode === "write"
                  ? "Por escrito"
                  : listening
                    ? "Te escucho"
                    : pending
                      ? "Un momento"
                      : mode === "ear"
                        ? "Al oído"
                        : "Altavoz"}
              </span>
            </div>
            <button type="button" onClick={closeAssistant} aria-label="Colgar">
              <X aria-hidden="true" />
            </button>
          </header>

          {mode === "write" ? (
            <div className="assistant__log" ref={logRef} aria-live="polite">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`assistant__msg assistant__msg--${message.role}`}
                >
                  {message.private ? (
                    <p>admin ••••••</p>
                  ) : (
                    <p>
                      <MessageText text={message.content} />
                    </p>
                  )}
                  {message.turnos && message.turnos.length > 0 && <AdminList turnos={message.turnos} />}
                  {message.reserva && <ReservaCard reserva={message.reserva} />}
                </div>
              ))}
              {pending && (
                <div className="assistant__msg assistant__msg--assistant assistant__typing" aria-label="Escribiendo">
                  <span />
                  <span />
                  <span />
                </div>
              )}
            </div>
          ) : (
            <div className="assistant__live" aria-live="polite">
              <p>{pending ? "Un momento" : listening ? "Te escucho" : "En llamada"}</p>
              <span>
                {mode === "ear"
                  ? "Acerca el celular a tu oreja y habla con normalidad."
                  : "Puedes dejar el celular sobre la mesa."}
              </span>
            </div>
          )}

          {mode === "write" && (
            <div className="assistant__ideas">
              <button type="button" onClick={() => void send("¿Qué servicios ofrecen?")}>
                Servicios
              </button>
              <button type="button" onClick={() => void send("¿Qué horarios tienen disponibles mañana?")}>
                <CalendarDays aria-hidden="true" />
                Horarios
              </button>
              <button type="button" onClick={() => void send("Quiero reservar un turno.")}>
                Reservar
              </button>
            </div>
          )}

          <div className="assistant__call">
            <button
              type="button"
              className={mode === "speaker" ? "is-on" : ""}
              onClick={() => chooseMode("speaker")}
              aria-pressed={mode === "speaker"}
            >
              <Volume2 aria-hidden="true" />
              Altavoz
            </button>
            <button
              type="button"
              className={mode === "ear" ? "is-on" : ""}
              onClick={() => chooseMode("ear")}
              aria-pressed={mode === "ear"}
            >
              <Phone aria-hidden="true" />
              Al oído
            </button>
            <button
              type="button"
              className={mode === "write" ? "is-on" : ""}
              onClick={() => chooseMode("write")}
              aria-pressed={mode === "write"}
            >
              <PenLine aria-hidden="true" />
              Escribir
            </button>
          </div>

          {mode === "write" && (
          <form onSubmit={onSubmit}>
            <input
              ref={inputRef}
              value={draft}
              maxLength={800}
              placeholder="Escribe tu pregunta"
              aria-label="Mensaje para el asistente"
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit" className="assistant__send" disabled={pending || !draft.trim()} aria-label="Enviar">
              <Send aria-hidden="true" />
            </button>
          </form>
          )}
        </section>
      )}
      {!open && (
        <button className="float-assistant" type="button" onClick={openAssistant}>
          <PhoneCall aria-hidden="true" />
          Hablar con recepción
        </button>
      )}
    </>
  );
}
