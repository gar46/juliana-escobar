import { site, whatsappUrl } from "../content";

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer__grid">
        <div>
          <p className="footer__name">{site.name}</p>
          <p>
            {site.tagline}. {site.role}.
          </p>
        </div>
        <div className="footer__links">
          <a href={whatsappUrl}>WhatsApp {site.phoneDisplay}</a>
          <a href={site.instagramUrl} target="_blank" rel="noreferrer">
            Instagram
          </a>
          <a href={site.facebookUrl} target="_blank" rel="noreferrer">
            Facebook
          </a>
        </div>
      </div>
      <p className="wrap footer__note">
        Logotipo, video y fotografía del letrero: archivo de Juliana Escobar.
      </p>
    </footer>
  );
}
