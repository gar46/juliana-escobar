import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { questions } from "../content";
import { Reveal } from "./Reveal";

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  const reduce = useReducedMotion();

  return (
    <section className="section" id="preguntas" aria-labelledby="titulo-preguntas">
      <div className="wrap faq-layout">
        <Reveal>
          <p className="pill">Preguntas</p>
          <h2 id="titulo-preguntas">Antes de escribirnos</h2>
        </Reveal>
        <div className="faq">
          {questions.map((item, index) => {
            const expanded = open === index;
            const panelId = `respuesta-${index}`;
            return (
              <Reveal className="faq__item" key={item.question} delay={index * 0.05}>
                <h3>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    onClick={() => setOpen(expanded ? null : index)}
                  >
                    {item.question}
                    <motion.span
                      aria-hidden="true"
                      animate={{ rotate: expanded ? 45 : 0 }}
                      transition={{ duration: reduce ? 0 : 0.3 }}
                    >
                      +
                    </motion.span>
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      id={panelId}
                      role="region"
                      className="faq__panel"
                      initial={reduce ? false : { height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={reduce ? undefined : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <p>{item.answer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
