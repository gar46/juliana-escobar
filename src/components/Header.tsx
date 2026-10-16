import { useEffect, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { Menu, X } from "lucide-react";
import { nav, site, whatsappUrl } from "../content";

export function Header() {
  const [open, setOpen] = useState(false);
  const [solid, setSolid] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (value) => setSolid(value > 40));

  useEffect(() => {
    document.body.classList.toggle("menu-open", open);
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header className={`header ${solid || open ? "header--solid" : ""}`}>
      <a className="skip" href="#contenido">
        Saltar al contenido
      </a>
      <div className="header__bar">
        <a className="brand" href="#inicio" onClick={close}>
          <img src="/brand/logo.png" alt="Juliana Escobar, estética avanzada" />
        </a>
        <nav className="nav" aria-label="Secciones">
          {nav.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <a className="button button--gold header__cta" href={whatsappUrl}>
          Agendar
        </a>
        <button
          className="menu-button"
          type="button"
          aria-expanded={open}
          aria-controls="menu-movil"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          <span className="visually-hidden">{open ? "Cerrar menú" : "Abrir menú"}</span>
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            className="drawer"
            id="menu-movil"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <nav aria-label="Secciones móviles">
              {nav.map((item, index) => (
                <motion.a
                  key={item.href}
                  href={item.href}
                  onClick={close}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * index + 0.08 }}
                >
                  {item.label}
                </motion.a>
              ))}
              <a className="button button--gold" href={whatsappUrl} onClick={close}>
                Agendar por WhatsApp
              </a>
            </nav>
            <p className="drawer__meta">
              {site.role}
              <br />
              {site.phoneDisplay}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
