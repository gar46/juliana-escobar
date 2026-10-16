import { useLayoutEffect, useRef } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { testimonials } from "../content";

export function Testimonials() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const distance = useMotionValue(0);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  useLayoutEffect(() => {
    const measure = () => {
      const track = trackRef.current;
      if (!track) return;
      distance.set(Math.max(0, track.scrollWidth - window.innerWidth));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [distance]);

  const x = useTransform([scrollYProgress, distance], ([progress, max]: number[]) => {
    const t = Math.min(1, Math.max(0, (progress - 0.12) / 0.76));
    return -max * t;
  });
  const headingOpacity = useTransform(scrollYProgress, [0, 0.1, 0.9, 1], [0.3, 1, 1, 0.3]);

  return (
    <section
      ref={sectionRef}
      className={`testimonials ${reduce ? "testimonials--static" : ""}`}
      id="testimonios"
      aria-labelledby="titulo-testimonios"
    >
      <div className="testimonials__sticky">
        <motion.div className="wrap" style={reduce ? undefined : { opacity: headingOpacity }}>
          <p className="pill">Experiencias</p>
          <h2 id="titulo-testimonios">Así se siente una buena cita.</h2>
        </motion.div>
        <motion.div
          ref={trackRef}
          className="quote-track"
          style={reduce ? undefined : { x }}
        >
          {testimonials.map((item) => (
            <figure className="quote" key={item.name}>
              <blockquote>
                <p>“{item.quote}”</p>
              </blockquote>
              <figcaption>
                <strong>{item.name}</strong>
                <span>{item.detail}</span>
              </figcaption>
            </figure>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
