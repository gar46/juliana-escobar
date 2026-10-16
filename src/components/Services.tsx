import { motion, useReducedMotion } from "motion/react";
import { services } from "../content";
import { Reveal } from "./Reveal";

export function Services() {
  const reduce = useReducedMotion();

  return (
    <section className="section" id="servicios" aria-labelledby="titulo-servicios">
      <div className="wrap services">
        <Reveal className="services__head">
          <p className="pill">Nuestros servicios</p>
          <h2 id="titulo-servicios">Lo que puedes agendar</h2>
          <p className="section__intro">
            Cinco maneras de cuidarte. El protocolo concreto se elige en la valoración,
            según lo que buscas y el tiempo que tengas.
          </p>
        </Reveal>
        <ol className="service-list">
          {services.map((service, index) => (
            <li key={service.title} className="service">
              <motion.span
                className="service__line"
                initial={reduce ? false : { scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true, margin: "0px 0px -10% 0px" }}
                transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                aria-hidden="true"
              />
              <Reveal x={index % 2 === 0 ? -36 : 36} y={0} className="service__body">
                <span className="service__number">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{service.title}</h3>
                  <p>{service.text}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
