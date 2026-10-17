export const site = {
  name: "Juliana Escobar",
  tagline: "Estética avanzada",
  role: "Cosmetóloga y esteticista",
  phoneDisplay: "316 496 1495",
  phoneE164: "573164961495",
  instagram: "juliana_escobar_cosmetologa",
  instagramUrl: "https://www.instagram.com/juliana_escobar_cosmetologa/",
  facebook: "JulianaEscobarCosmetologa",
  facebookUrl: "https://www.facebook.com/JulianaEscobarCosmetologa",
};

export const whatsappUrl = `https://wa.me/${site.phoneE164}?text=${encodeURIComponent(
  "Hola Juliana, quiero agendar una valoración.",
)}`;

export const nav = [
  { href: "#sobre-mi", label: "Sobre mí" },
  { href: "#servicios", label: "Servicios" },
  { href: "#experiencia", label: "El estudio" },
  { href: "#testimonios", label: "Experiencias" },
  { href: "#preguntas", label: "Preguntas" },
  { href: "#contacto", label: "Contacto" },
];

export const services = [
  {
    title: "Tratamientos faciales",
    text: "Protocolos para acompañar la textura, la luminosidad y el confort de la piel. Se definen después de ver qué necesita ese día.",
  },
  {
    title: "Tratamientos corporales",
    text: "Sesiones para soltar el cuerpo y retomar el cuidado con un ritmo más pausado.",
  },
  {
    title: "Limpieza facial",
    text: "Una limpieza cuidadosa, adaptada a tu piel, sin apuros y con el tiempo que haga falta.",
  },
  {
    title: "Masajes de relajación",
    text: "Manos firmes y un ritmo lento para aflojar la tensión que se acumula en el día.",
  },
  {
    title: "Días de SPA",
    text: "Una experiencia más larga para desconectarte y dedicarte ese tiempo completo.",
  },
];

export const benefits = [
  {
    title: "Primero, una valoración",
    text: "Antes de proponer un protocolo conversamos qué buscas y cómo está tu piel o tu cuerpo ese día.",
  },
  {
    title: "Facial y corporal, en un solo lugar",
    text: "Limpieza, tratamientos, masaje y días de spa conviven en la misma atención.",
  },
  {
    title: "Un espacio íntimo",
    text: "El estudio está pensado para que la cita se sienta privada, cálida y sin prisa.",
  },
];

export const testimonials = [
  {
    quote:
      "Quería una limpieza facial sin sentirme apurada. El ritmo de la cita me dejó la piel cómoda y la tarde más liviana.",
    name: "Camila",
    detail: "Limpieza facial",
  },
  {
    quote:
      "Fui por un masaje de relajación y salí con los hombros sueltos. Se nota que el tiempo de la sesión es parte del cuidado.",
    name: "Laura",
    detail: "Masaje de relajación",
  },
  {
    quote:
      "El día de spa fue exactamente eso: desconectarme un rato. Me explicaron cada paso antes de empezarlo.",
    name: "Mariana",
    detail: "Día de SPA",
  },
];

export const questions = [
  {
    question: "¿Cómo agendo una cita?",
    answer:
      "Escríbenos por WhatsApp al 316 496 1495. Cuéntanos qué te interesa y te proponemos un horario.",
  },
  {
    question: "¿Dónde queda el estudio?",
    answer:
      "La dirección se confirma al agendar, para coordinar tu llegada con calma. También puedes escribirnos por Instagram.",
  },
  {
    question: "¿Puedo preguntar antes de reservar?",
    answer:
      "Sí. Si tienes dudas sobre una limpieza, un tratamiento o un día de spa, las resolvemos por WhatsApp antes de separar la cita.",
  },
  {
    question: "¿Qué incluye un día de spa?",
    answer:
      "Se arma según el tiempo que tengas y lo que quieras trabajar: rostro, cuerpo o una combinación de ambos. Lo definimos juntas al agendar.",
  },
  {
    question: "¿El mismo protocolo sirve para todas las pieles?",
    answer:
      "No. Por eso la valoración va primero. A partir de ella se elige lo que tiene sentido para ti, sin prometer un resultado igual para todas.",
  },
];
