import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";

const words = ["Faciales", "Corporales", "Limpieza", "Relajación", "Días de SPA"];

export function Marquee() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const forward = useTransform(scrollYProgress, [0, 1], ["0%", "-38%"]);
  const backward = useTransform(scrollYProgress, [0, 1], ["-38%", "0%"]);

  const row = [...words, ...words, ...words];

  return (
    <div className="marquee" ref={ref} aria-hidden="true">
      <motion.p style={reduce ? undefined : { x: forward }}>
        {row.map((word, index) => (
          <span key={`a-${index}`}>{word}</span>
        ))}
      </motion.p>
      <motion.p className="marquee__outline" style={reduce ? undefined : { x: backward }}>
        {row.map((word, index) => (
          <span key={`b-${index}`}>{word}</span>
        ))}
      </motion.p>
    </div>
  );
}
