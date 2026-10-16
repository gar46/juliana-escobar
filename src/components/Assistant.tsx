import { FormEvent, Fragment, useCallback, useEffect, useId, useRef, useState } from "react";
import { CalendarDays, Mic, MicOff, Send, Volume2, VolumeX, X } from "lucide-react";
import { whatsappUrl } from "../content";

type Turno = {
  fecha: string;
  hora: string;
  nombre: string;
  telefono: string;
  servicio: string;
  nota?: string;
};

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
  private?: boolean;
  turnos?: Turno[];
};

type AssistantResponse = {
  reply?: string;
  error?: string;
  admin?: boolean;
  turnos?: Turno[];
};

type RecognitionEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> };

type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
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

function pickVoice() {
  const voices = window.speechSynthesis.getVoices();
  const spanish = voices.filter((voice) => voice.lang.toLowerCase().startsWith("es"));
  for (const lang of ["es-co", "es-mx", "es-us", "es-419", "es-es"]) {
    const match = spanish.find((voice) => voice.lang.toLowerCase() === lang);
    if (match) return match;
  }
  return spanish[0];
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
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([greeting]);
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
  const canListen = Boolean(recognitionConstructor());
  const hasAdmin = messages.some((message) => message.turnos);

  const speak = useCallback(
    (text: string) => {
      if (!canSpeak || !voiceOn) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(speakable(text));
      const voice = pickVoice();
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang || "es-CO";
      utterance.rate = 1;
      window.speechSynthesis.speak(utterance);
    },
    [canSpeak, voiceOn],
  );

  useEffect(() => {
    if (!canSpeak) return;
    window.speechSynthesis.getVoices();
    const load = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [canSpeak]);

  useEffect(() => {
    if (!open) {
      if (canSpeak) window.speechSynthesis.cancel();
      recognitionRef.current?.stop();
      return;
    }
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, canSpeak]);

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
    if (!content || pending) return;
    const isPrivate = ADMIN_PATTERN.test(content);
    const userMessage: ChatMessage = { role: "user", content, private: isPrivate };
    const next = [...messages, userMessage];
    setMessages(next);
    setDraft("");
    setPending(true);

    const history = next
      .filter((item) => item !== greeting && !item.turnos && (!item.private || item === userMessage))
      .map(({ role, content: body }) => ({ role, content: body }));

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: isPrivate ? [history[history.length - 1]] : history }),
      });
      const data = (await response.json()) as AssistantResponse;
      const reply =
        data.reply ||
        data.error ||
        `No pude responder ahora. Puedes escribirnos por WhatsApp: ${whatsappUrl}`;
      setMessages((current) => [
        ...current,
        { role: "assistant", content: reply, turnos: data.admin ? data.turnos || [] : undefined },
      ]);
      if (!data.admin) speak(reply);
    } catch {
      const reply = `No pude conectarme en este momento. Escríbenos por WhatsApp y te atendemos enseguida: ${whatsappUrl}`;
      setMessages((current) => [...current, { role: "assistant", content: reply }]);
      speak(reply);
    } finally {
      setPending(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(draft);
  }

  function toggleVoice() {
    if (voiceOn && canSpeak) window.speechSynthesis.cancel();
    setVoiceOn((value) => !value);
  }

  function toggleListening() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Constructor = recognitionConstructor();
    if (!Constructor) return;
    const recognition = new Constructor();
    recognition.lang = "es-CO";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript || "";
      if (transcript) {
        setVoiceOn(true);
        void send(transcript);
      }
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  return (
    <>
      {open && (
        <section
          className={`assistant ${hasAdmin ? "assistant--wide" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <header className="assistant__bar">
            <div>
              <p id={titleId}>Recepción</p>
              <span>Faciales, masajes y días de spa</span>
            </div>
            <div className="assistant__tools">
              {canSpeak && (
                <button
                  type="button"
                  onClick={toggleVoice}
                  aria-pressed={voiceOn}
                  aria-label={voiceOn ? "Silenciar voz" : "Escuchar respuestas"}
                  title={voiceOn ? "Silenciar voz" : "Escuchar respuestas"}
                >
                  {voiceOn ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar asistente">
                <X aria-hidden="true" />
              </button>
            </div>
          </header>

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
            <a href={whatsappUrl} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
          </div>

          <form onSubmit={onSubmit}>
            {canListen && (
              <button
                type="button"
                className={`assistant__mic ${listening ? "is-listening" : ""}`}
                onClick={toggleListening}
                aria-pressed={listening}
                aria-label={listening ? "Detener dictado" : "Hablar"}
                title={listening ? "Detener dictado" : "Hablar"}
              >
                {listening ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}
              </button>
            )}
            <input
              ref={inputRef}
              value={draft}
              maxLength={800}
              placeholder={listening ? "Te escucho…" : "Escribe tu pregunta"}
              aria-label="Mensaje para el asistente"
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit" className="assistant__send" disabled={pending || !draft.trim()} aria-label="Enviar">
              <Send aria-hidden="true" />
            </button>
          </form>
        </section>
      )}
      <button
        className="float-assistant"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Asistente
      </button>
    </>
  );
}
