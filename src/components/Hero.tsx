import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { openAssistant } from "../assistantBus";
import { site } from "../content";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { CinemaVideo } from "./CinemaVideo";

const titleLines = ["Cuidado facial", "y corporal,", "con tiempo", "de verdad."];

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const desktop = useMediaQuery("(min-width: 960px)");
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  const videoScale = useTransform(scrollYProgress, [0, 1], [1, 1.2]);
  const shade = useTransform(scrollYProgress, [0, 0.55], [0.2, 0.68]);
  const bars = useTransform(scrollYProgress, [0, 1], ["0svh", "8svh"]);
  const titleY = useTransform(scrollYProgress, [0, 0.42], [0, -110]);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.36], [1, 0]);
  const detailY = useTransform(scrollYProgress, [0.38, 0.7], [60, 0]);
  const detailOpacity = useTransform(scrollYProgress, [0.38, 0.62], [0, 1]);
  const frameY = useTransform(scrollYProgress, [0, 1], [0, -36]);
  const cueOpacity = useTransform(scrollYProgress, [0, 0.12], [1, 0]);

  const motionStyle = <T,>(value: T) => (reduce ? undefined : value);

  return (
    <section
      ref={ref}
      className={`hero ${reduce ? "hero--static" : ""}`}
      id="inicio"
      aria-labelledby="titulo-principal"
    >
      <div className="hero__sticky">
        <CinemaVideo className="hero__video" style={motionStyle({ scale: videoScale })} />
        <motion.div className="hero__shade" style={motionStyle({ opacity: shade })} />
        <motion.div className="hero__bar hero__bar--top" style={motionStyle({ height: bars })} />
        <motion.div className="hero__bar hero__bar--bottom" style={motionStyle({ height: bars })} />

        <div className="wrap hero__grid">
          <div className="hero__copy">
            <motion.div style={motionStyle({ y: titleY, opacity: titleOpacity })}>
              <motion.p
                className="pill"
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                {site.tagline}
              </motion.p>
              <h1 id="titulo-principal">
                {titleLines.map((line, index) => (
                  <span className="line" key={line}>
                    <motion.span
                      initial={reduce ? false : { y: "110%" }}
                      animate={{ y: "0%" }}
                      transition={{ duration: 1, delay: 0.3 + index * 0.12, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {line}
                    </motion.span>
                  </span>
                ))}
              </h1>
            </motion.div>

            <motion.div
              className="hero__detail"
              style={motionStyle({ y: detailY, opacity: detailOpacity })}
            >
              <p className="eyebrow">
                {site.name} · {site.role}
              </p>
              <p className="lede">
                Limpiezas, tratamientos faciales y corporales, masajes de relajación
                y días de spa en un estudio cálido y privado.
              </p>
              <div className="hero__actions">
                <button className="button button--gold" type="button" onClick={openAssistant}>
                  Reservar con recepción
                </button>
                <a className="button button--ghost" href="#servicios">
                  Ver servicios
                </a>
              </div>
            </motion.div>
          </div>

          {desktop && (
            <motion.figure className="hero__frame" style={motionStyle({ y: frameY })}>
              <CinemaVideo className="hero__frame-video" />
            </motion.figure>
          )}
        </div>

        <motion.div className="scroll-cue" style={motionStyle({ opacity: cueOpacity })} aria-hidden="true">
          <span>Desliza</span>
          <i />
        </motion.div>
      </div>
    </section>
  );
}
