import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { Reveal } from "./Reveal";

export function Experience() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });

  const clipPath = useTransform(
    scrollYProgress,
    [0.05, 0.45],
    ["inset(22% 16% 22% 16% round 999px)", "inset(0% 0% 0% 0% round 0px)"],
  );
  const imageScale = useTransform(scrollYProgress, [0, 1], [1.3, 1]);
  const glow = useTransform(scrollYProgress, [0.2, 0.5], [0, 1]);

  return (
    <section ref={ref} className="section" id="experiencia" aria-labelledby="titulo-experiencia">
      <div className="wrap experience">
        <motion.figure
          className="experience__media"
          style={reduce ? undefined : { clipPath }}
        >
          <motion.img
            src="/brand/letrero.jpg"
            alt="Letrero iluminado de Juliana Escobar, estética avanzada, en la pared del estudio."
            style={reduce ? undefined : { scale: imageScale }}
          />
          <motion.span
            className="experience__glow"
            style={reduce ? undefined : { opacity: glow }}
            aria-hidden="true"
          />
        </motion.figure>

        <Reveal className="experience__copy">
          <p className="pill">El estudio</p>
          <h2 id="titulo-experiencia">Una cita sin reloj encima.</h2>
          <p className="experience__lead">
            Llegas, conversamos y el tratamiento avanza al ritmo que tu piel necesita ese día.
          </p>
          <ul className="experience__facts">
            <li>
              <span>01</span>
              Valoración antes de proponer cualquier protocolo.
            </li>
            <li>
              <span>02</span>
              Facial, corporal, limpieza, masaje o día de spa.
            </li>
            <li>
              <span>03</span>
              Un espacio privado, con luz cálida y sin prisa.
            </li>
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
