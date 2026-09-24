# Booveshwaran T — Portfolio

Personal portfolio: agentic AI systems and production web platforms.

**Live:** https://boovesh985.github.io

## What's inside

- **Decrypt hero** — the name renders as ciphertext; the cursor trail reveals it in tempered-steel colours (a nod to the encrypted-ECG project).
- **Morphing particle field** (Three.js, custom shaders) — ~26k points that reshape per section: sphere → steel pipe bundle → multi-agent graph → heart with ECG trace → spiral. A GPU mouse-trail buffer bends and colour-splits the particles.
- **Scroll choreography** (GSAP ScrollTrigger + SplitText, Lenis smooth scroll) — line masks, word scrubs, clip-path image reveals, counters.
- **Case-study pages** for each featured project, linked with curtain page transitions and a looping "next project".

## Develop

```bash
npm install
npm run dev      # generates case-study pages, starts Vite
npm run build    # production build into dist/
```

Case-study content lives in `src/data/projects.js`; `scripts/build-pages.mjs` renders it to `projects/<slug>/index.html`.

Run `npm run deploy` to build and publish `dist/` to the `gh-pages` branch, which GitHub Pages serves.
