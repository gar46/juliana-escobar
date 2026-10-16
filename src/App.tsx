import { Benefits } from "./components/Benefits";
import { Contact } from "./components/Contact";
import { Experience } from "./components/Experience";
import { Faq } from "./components/Faq";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { Marquee } from "./components/Marquee";
import { ScrollProgress } from "./components/ScrollProgress";
import { Services } from "./components/Services";
import { Testimonials } from "./components/Testimonials";
import { Assistant } from "./components/Assistant";

export default function App() {
  return (
    <>
      <ScrollProgress />
      <Header />
      <main id="contenido">
        <Hero />
        <Marquee />
        <Services />
        <Benefits />
        <Experience />
        <Testimonials />
        <Faq />
        <Contact />
      </main>
      <Footer />
      <Assistant />
    </>
  );
}
