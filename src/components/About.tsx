import { CalendarHeart } from "lucide-react";
import { openAssistant } from "../assistantBus";
import { Reveal } from "./Reveal";

const bio = [
  "Juliana Escobar es una destacada cosmetóloga profesional con más de 10 años de sólida trayectoria en el cuidado estético y el bienestar integral.",
  "Su carrera se define por un profundo compromiso con la excelencia: combina un trato humano excepcional con las técnicas y tratamientos más avanzados del mercado.",
  "Ha consolidado su formación con estudios técnicos de alto nivel y diplomados de especialización en aparatología estética avanzada, tratamientos faciales antienvejecimiento, técnicas corporales y cuidado preventivo de la piel.",
  "Esa preparación le permite diseñar protocolos personalizados, adaptados a las necesidades reales de cada paciente, con resultados visibles y seguros.",
  "Su ética de trabajo, su constante actualización y su pasión por transformar el bienestar físico y emocional de quienes confían en sus manos la han convertido en un referente del sector de la belleza.",
];

export function About() {
  return (
    <section className="section" id="sobre-mi" aria-labelledby="titulo-sobre-mi">
      <div className="wrap about">
        <Reveal className="about__media" y={20}>
          <figure>
            <img
              src="/brand/juliana.jpg"
              alt="Juliana Escobar, cosmetóloga, en su estudio con uniforme café."
              loading="lazy"
              width={765}
              height={1024}
            />
          </figure>
        </Reveal>

        <Reveal className="about__copy" delay={0.1}>
          <p className="pill">Sobre mí</p>
          <h2 id="titulo-sobre-mi">Ciencia y pasión al servicio de la salud de tu piel.</h2>
          {bio.map((paragraph) => (
            <p key={paragraph.slice(0, 24)}>{paragraph}</p>
          ))}
          <button className="button button--gold about__cta" type="button" onClick={openAssistant}>
            <CalendarHeart aria-hidden="true" />
            Agenda tu cita con Juliana
          </button>
        </Reveal>
      </div>
    </section>
  );
}
