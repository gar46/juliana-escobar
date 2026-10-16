---
title: Webs que parecen profesionales con Claude Code: la guía de diseño
slug: web-profesional-claude-code
type: guide
published_at: 2026-10-13
source: https://juanbertorello.com/r/web-profesional-claude-code
---

# Webs que parecen profesionales con Claude Code: la guía de diseño

> Lo del video en orden (Claude Code, el comando de Motion para las animaciones, la skill UI UX Pro Max y el comando de 21st.dev) más otras skills de diseño, el pedido para armar la web y cómo ofrecérsela a un negocio.

---

# Webs que parecen profesionales con Claude Code: la guía de diseño

Lo que te mostré en el video, en el mismo orden: Claude Code, el comando de las animaciones, la skill UI UX Pro Max y el comando de 21st.dev. Después, más skills para que el diseño suba otro escalón, el pedido exacto para armar la web y cómo ofrecérsela a un negocio. Links verificados el 13 de octubre de 2026.

## 1. Instalá Claude Code

Es la versión de Claude que trabaja en tu compu: crea los archivos, instala lo que hace falta y levanta la web para que la veas. Necesitás un plan pago de Claude (Pro alcanza para arrancar).

- Web e instalación: [claude.com/claude-code](https://claude.com/claude-code)
- Primeros pasos: [documentación oficial](https://code.claude.com/docs/en/quickstart)

Creá una carpeta vacía para la web, abrí la terminal ahí y escribí `claude`.

## 2. Las animaciones: Motion (ex Framer Motion)

Framer Motion ahora se llama **Motion** y es la librería de animaciones más usada en React. En su web tienen un comando que le instala a Claude Code una skill (`/motion`) y su servidor de documentación, así anima con la versión actual y no con código viejo.

- Web: [motion.dev](https://motion.dev)
- El comando, para pegar en la terminal:

```
npx motion-ai
```

- Qué instala, explicado por ellos: [Motion AI Kit](https://motion.dev/docs/ai-kit) · código: [github.com/motiondivision/ai-kit](https://github.com/motiondivision/ai-kit)

Es gratis y de código abierto. Después, cuando le pidas la web, decile «usá Motion para las animaciones».

## 3. La skill UI UX Pro Max

Una skill gratis que le da a Claude criterio de diseño: estilos, paletas, combinaciones de tipografías y reglas de experiencia de usuario según el tipo de negocio.

- Repo: [github.com/nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
- Instalación dentro de Claude Code (dos comandos, uno por vez):

```
/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
/plugin install ui-ux-pro-max@ui-ux-pro-max-skill
```

Después pedile a Claude Code que la use: «usá la skill ui-ux-pro-max para elegir el estilo».

## 4. Los componentes: 21st.dev

Una biblioteca enorme de componentes ya diseñados (portadas, precios, testimonios, menús, fondos animados). Con su comando, Claude Code los busca y los mete en tu web sin que copies nada a mano.

- Web: [21st.dev](https://21st.dev)
- La llave gratis y el paso a paso: [21st.dev/mcp](https://21st.dev/mcp)
- El comando, para pegar en la terminal:

```
npx @21st-dev/cli@latest init --client claude
```

- Repo: [github.com/21st-dev/magic-mcp](https://github.com/21st-dev/magic-mcp)

## 5. El pedido para armar la web

Con todo instalado, pegale esto a Claude Code y completá los corchetes:

```
Armame la web de [tipo de negocio] llamado [nombre], en [ciudad].
Objetivo: que la gente [reserve / pida presupuesto / escriba por WhatsApp].
Secciones: portada con una frase fuerte y un botón, servicios, por qué elegirnos, testimonios, preguntas frecuentes y contacto con mapa.

Diseño:
- Usá la skill ui-ux-pro-max para elegir estilo, paleta y tipografías que encajen con el rubro.
- Usá Motion para animaciones suaves al hacer scroll y al pasar el mouse. Nada exagerado.
- Buscá en 21st.dev los componentes de la portada, los testimonios y las preguntas.
- Que se vea perfecta en el celular primero.

Textos: [pegá los tuyos o pedile que los escriba con el tono del negocio].
Mostrame primero la estructura y la paleta, y cuando te diga que sí, armala y levantala para verla en el navegador.
```

Después pedí cambios con texto, como se los pedirías a un diseñador: «la portada más aireada», «el botón en el color de acento», «menos animación en el celular».

## Más skills para aplicar

- **frontend-design** (oficial de Anthropic): hace que Claude evite el diseño genérico de IA. [Repo](https://github.com/anthropics/skills/tree/main/skills/frontend-design)
- **DESIGN.md de un sistema de diseño**: le pasás el estilo completo de una web que te guste y la IA lo respeta en todo el sitio. Lo expliqué paso a paso en [/r/design-md-web-premium](/r/design-md-web-premium).
- **Referencias por sección**: 8 webs con ejemplos reales de menús, pies, botones y secciones para pasarle a Claude. Están en [/r/8-webs-diseno-claude](/r/8-webs-diseno-claude).

## Para publicarla

Pedile a Claude Code que la deje lista para subir y publicala gratis en [Vercel](https://vercel.com) o en [Netlify](https://www.netlify.com). El dominio del negocio se compra aparte y se conecta desde ahí.

## Cómo ofrecerla a un negocio

- **Armala antes de la reunión.** Elegí un negocio con una web vieja (o sin web), armale la versión nueva y mostrásela. Se vende sola mucho más fácil que una propuesta en PDF.
- **Cobrá también el mantenimiento.** Cambios de textos, fotos nuevas, promociones del mes: eso es lo que hace que el cliente se quede.
- **No copies la web de otro.** Inspirate en el estilo, pero los textos, las fotos y el logo son del negocio.


---

Recurso de @juanbertorello.ia — juanbertorello.com