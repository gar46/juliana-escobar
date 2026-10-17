import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { openAssistant } from "../assistantBus";
import { site, whatsappUrl } from "../content";
import { Reveal } from "./Reveal";

export function Contact() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const scale = useTransform(scrollYProgress, [0, 1], [0.86, 1]);
  const glow = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section ref={ref} className="section contact" id="contacto" aria-labelledby="titulo-contacto">
      <motion.span className="contact__glow" style={reduce ? undefined : { opacity: glow }} aria-hidden="true" />
      <div className="wrap contact__grid">
        <motion.div style={reduce ? undefined : { scale }} className="contact__lead">
          <p className="pill pill--line">Contacto</p>
          <h2 id="titulo-contacto">Agenda tu valoración.</h2>
          <p className="lede">
            Cuéntanos si buscas una limpieza, un tratamiento, un masaje o un día de spa.
            Nuestra recepcionista virtual te orienta, revisa horarios y reserva tu cita al momento.
          </p>
          <button className="button button--gold" type="button" onClick={openAssistant}>
            Hablar con Asesor
          </button>
        </motion.div>
        <Reveal className="contact__card" delay={0.1}>
          <dl>
            <div>
              <dt>WhatsApp</dt>
              <dd>
                <a href={whatsappUrl}>{site.phoneDisplay}</a>
              </dd>
            </div>
            <div>
              <dt>Instagram</dt>
              <dd>
                <a href={site.instagramUrl} target="_blank" rel="noreferrer">
                  @{site.instagram}
                </a>
              </dd>
            </div>
            <div>
              <dt>Facebook</dt>
              <dd>
                <a href={site.facebookUrl} target="_blank" rel="noreferrer">
                  {site.facebook}
                </a>
              </dd>
            </div>
            <div>
              <dt>Horario</dt>
              <dd>Lunes a sábado, 9:00 a 18:00</dd>
            </div>
          </dl>
        </Reveal>
      </div>
    </section>
  );
}
