import { FormEvent, useEffect, useId, useRef, useState } from "react";

type ChatMessage = {
  role: "assistant" | "user";
  content: string;
};

const greeting: ChatMessage = {
  role: "assistant",
  content:
    "Hola, soy el asistente de Juliana. Puedo contarte los servicios, revisar horarios y reservar un turno de una hora.",
};

const endpoint =
  import.meta.env.VITE_ASSISTANT_URL ||
  (import.meta.env.DEV
    ? "/api/assistant"
    : "https://juliana-asistente.juliana-escobar.workers.dev/api/assistant");

export function Assistant() {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([greeting]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || pending) return;
    const history = [...messages, { role: "user" as const, content }];
    setMessages(history);
    setDraft("");
    setPending(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.filter((item) => item !== greeting),
        }),
      });
      const data = (await response.json()) as { reply?: string; error?: string };
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.reply || data.error || "No pude responder. Intenta de nuevo.",
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: "No pude conectar con el asistente. También puedes escribir por WhatsApp.",
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(draft);
  }

  return (
    <>
      {open && (
        <section className="assistant" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <header className="assistant__bar">
            <div>
              <p id={titleId}>Asistente</p>
              <span>Horarios y turnos de una hora</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar asistente">
              ×
            </button>
          </header>
          <div className="assistant__log">
            {messages.map((message, index) => (
              <p key={`${message.role}-${index}`} className={`assistant__msg assistant__msg--${message.role}`}>
                {message.content}
              </p>
            ))}
            {pending && <p className="assistant__msg assistant__msg--assistant">Estoy revisando…</p>}
          </div>
          <div className="assistant__ideas">
            <button type="button" onClick={() => void send("¿Qué horarios hay mañana?")}>
              Horarios
            </button>
            <button type="button" onClick={() => void send("Quiero agendar un turno de una hora.")}>
              Agendar
            </button>
          </div>
          <form onSubmit={onSubmit}>
            <input
              ref={inputRef}
              value={draft}
              maxLength={800}
              placeholder="Escribe tu pregunta"
              aria-label="Mensaje para el asistente"
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit" disabled={pending || !draft.trim()}>
              Enviar
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
