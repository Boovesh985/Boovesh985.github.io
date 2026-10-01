# Booveshwaran T — Portfolio

Personal portfolio of an AI engineer and full-stack developer: agentic AI systems and production web platforms.

**Live:** https://boovesh985.github.io

## What's inside

- **Decrypt hero.** The name renders as ciphertext, and the cursor trail reveals it in tempered-steel colours (a nod to the encrypted-ECG project). On touch screens it sweeps on its own.
- **Morphing particle field** (Three.js, custom shaders). About 24k points (12k on phones) reshape per section: planet → steel pipe bundle → multi-agent graph → heart with ECG trace → film reel → spiral. A GPU mouse-trail buffer bends and colour-splits them.
- **The Voyage.** A scroll-driven dive with a 3D astronaut through five layers of the stack: interface, services, data, models and ciphertext. Click or tap to make the astronaut flip.
- **3D props** that live inside the page: typing keycaps for the toolkit, a graduation cap, and a waving astronaut by the contact section.
- **Scroll choreography** (GSAP ScrollTrigger + SplitText, Lenis smooth scroll): line masks, word scrubs, clip-path image reveals and counters.
- **Case-study pages** for each featured project, linked with curtain page transitions and a looping "next project".

## Performance

The 3D work is set up so that nothing freezes the page:

- Shaders compile in parallel before anything is shown (`compileAsync`), and the loader's counter follows that real work.
- The astronaut's suit textures are generated in a Web Worker.
- The Voyage and the 3D props share one WebGL renderer, so their shaders compile once.
- Props are built in idle time and only render while on screen.

## Accessibility

- Reduced motion is respected: the Voyage becomes a still frame with its layers listed.
- Keyboard focus is visible, and headings follow a proper outline.
- Every image has alt text.
- Layouts are tested from 320px phones up to wide desktops.

## Project structure

```
index.html              home page
src/main.js             scroll, reveals, loader, section themes
src/style.css           all styles
src/data/projects.js    case-study content
src/gl/                 particles (gl.js), Voyage, astronaut, 3D props, shader warm-up
src/lib/                cursor, magnetic buttons, text scramble, page transitions
scripts/build-pages.mjs renders projects/<slug>/index.html from the data
scripts/deploy.mjs      builds and publishes dist/ to gh-pages
public/                 images, favicon, social card, robots.txt, sitemap.xml
```

## Develop

```bash
npm install
npm run dev      # generates case-study pages, starts Vite
npm run build    # production build into dist/
npm run preview  # serve the production build locally
```

Case-study content lives in `src/data/projects.js`; `scripts/build-pages.mjs` renders it to `projects/<slug>/index.html`.

## Deploy

```bash
npm run deploy
```

This builds the site and publishes `dist/` to the `gh-pages` branch. GitHub Pages must be set to serve **`gh-pages` / root**: serving `main` shows the raw source, and the site won't start.

## Stack

Vite · Three.js · GSAP (ScrollTrigger, SplitText) · Lenis · Big Shoulders Display, Hanken Grotesk and Martian Mono via Fontsource
