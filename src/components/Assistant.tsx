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
  const controls = useRef({ open: false, pending: false, speaking: false, wantMic: true, voiceOn: true });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([greeting]);
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
  const canListen = Boolean(recognitionConstructor());

  controls.current.open = open;
  controls.current.voiceOn = voiceOn;

  const beginListeningRef = useRef<() => void>(() => {});
  const resumeMic = useCallback(() => {
    window.setTimeout(() => {
      const state = controls.current;
      if (state.open && state.wantMic && !state.speaking && !state.pending) beginListeningRef.current();
    }, 280);
  }, []);

  const stopListening = useCallback(() => {
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
    const recognition = new Constructor();
    recognition.lang = "es-CO";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      let interim = "";
      let finalText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript || "";
        if (result.isFinal) finalText += transcript;
        else interim += transcript;
      }
      if (interim) setDraft(interim);
      const spoken = finalText.trim();
      if (!spoken || controls.current.pending) return;
      setDraft("");
      stopListening();
      void sendRef.current(spoken);
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        controls.current.wantMic = false;
        setListening(false);
      }
    };
    recognition.onend = () => {
      if (sessionRef.current !== session) return;
      setListening(false);
      resumeMic();
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [resumeMic, stopListening]);

  const speak = useCallback(
    (text: string) => {
      if (!canSpeak || !controls.current.voiceOn) return;
      window.speechSynthesis.cancel();
      controls.current.speaking = true;
      stopListening();
      const voice = pickVoice();
      const parts = speakable(text)
        .split(/(?<=[.!?])\s+/)
        .map((part) => part.trim())
        .filter(Boolean);
      let index = 0;
      const next = () => {
        if (!controls.current.speaking || index >= parts.length) {
          controls.current.speaking = false;
          resumeMic();
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
        utterance.onend = next;
        utterance.onerror = next;
        window.speechSynthesis.speak(utterance);
      };
      next();
      window.speechSynthesis.resume();
    },
    [canSpeak, resumeMic, stopListening],
  );

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
    controls.current.pending = true;
    stopListening();
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
      controls.current.pending = false;
      setPending(false);
      if (!controls.current.speaking) resumeMic();
    }
  }

  sendRef.current = send;

  function closeAssistant() {
    controls.current.open = false;
    controls.current.speaking = false;
    controls.current.wantMic = false;
    setOpen(false);
    stopListening();
    if (canSpeak) window.speechSynthesis.cancel();
    setListening(false);
  }

  closeRef.current = closeAssistant;

  function openAssistant() {
    controls.current.open = true;
    controls.current.wantMic = true;
    setOpen(true);
    beginListening();
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(draft);
  }

  function toggleVoice() {
    if (voiceOn) {
      controls.current.speaking = false;
      if (canSpeak) window.speechSynthesis.cancel();
      setVoiceOn(false);
      resumeMic();
      return;
    }
    setVoiceOn(true);
  }

  function toggleListening() {
    if (listening) {
      controls.current.wantMic = false;
      stopListening();
      return;
    }
    controls.current.wantMic = true;
    beginListening();
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
              <button type="button" onClick={closeAssistant} aria-label="Cerrar asistente">
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
      {!open && (
        <button className="float-assistant" type="button" onClick={openAssistant}>
          Asistente
        </button>
      )}
    </>
  );
}
