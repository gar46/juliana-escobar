import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { benefits } from "../content";
import { Reveal } from "./Reveal";

type BenefitCardProps = {
  title: string;
  text: string;
  index: number;
  progress: MotionValue<number>;
};

function BenefitCard({ title, text, index, progress }: BenefitCardProps) {
  const reduce = useReducedMotion();
  const distance = 30 + index * 28;
  const y = useTransform(progress, [0, 1], [distance, -distance]);

  return (
    <motion.article className="benefit" style={reduce ? undefined : { y }}>
      <span className="benefit__index">{String(index + 1).padStart(2, "0")}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </motion.article>
  );
}

export function Benefits() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });

  return (
    <section ref={ref} className="section section--glow" aria-labelledby="titulo-elegirnos">
      <div className="wrap">
        <Reveal>
          <p className="pill pill--line">Por qué este estudio</p>
          <h2 id="titulo-elegirnos">Un cuidado que se toma el tiempo de conocerte.</h2>
        </Reveal>
        <div className="benefit-grid">
          {benefits.map((benefit, index) => (
            <BenefitCard
              key={benefit.title}
              title={benefit.title}
              text={benefit.text}
              index={index}
              progress={scrollYProgress}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
