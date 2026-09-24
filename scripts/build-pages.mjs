// Renders one static case-study page per project into /projects/<slug>/index.html.
// Run automatically before `vite build` and `vite dev` (see package.json).
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { projects } from '../src/data/projects.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const frame = (img, extra = '') => {
  const cls = ['shot__frame', img.square && 'shot__frame--square', img.paper && 'shot__frame--paper', extra].filter(Boolean).join(' ')
  return `<div class="${cls}"><img src="${img.src}" alt="${esc(img.alt)}" loading="lazy" /></div>`
}

function page(p, i) {
  const next = projects[(i + 1) % projects.length]
  const title = p.title.join(' ')
  const layer = (cls) => `<span class="hero__layer ${cls}" aria-hidden="true">${p.title.map(esc).join('<br />')}</span>`
  return `<!doctype html>
<html lang="en" data-theme="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(title)} — Booveshwaran T</title>
    <meta name="description" content="${esc(p.summary)}" />
    <meta name="theme-color" content="#0E1114" />
    <meta property="og:title" content="${esc(title)} — Booveshwaran T" />
    <meta property="og:description" content="${esc(p.summary)}" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <script>try{if(sessionStorage.getItem('bt-transition'))document.documentElement.classList.add('is-arriving')}catch(e){}</script>
  </head>
  <body data-page="project" data-shape="${p.shape}">
    <div class="curtain" aria-hidden="true"><span class="curtain__label mono"></span><div class="curtain__bar"><i></i></div></div>
    <canvas class="gl" aria-hidden="true"></canvas>
    <div class="cursor" aria-hidden="true"><div class="cursor__ring"><span class="cursor__label"></span></div><div class="cursor__dot"></div></div>

    <header class="nav">
      <a href="/" class="nav__brand" data-transition="Home" data-magnetic aria-label="Home">
        <span class="nav__mark">BT</span>
        <span class="nav__name mono js-hover-scramble">Booveshwaran T</span>
      </a>
      <nav class="nav__links mono" aria-label="Primary">
        <a href="/#work" data-transition="Selected work" class="js-hover-scramble">Work</a>
        <a href="/#about" data-transition="About" class="js-hover-scramble">About</a>
        <a href="/#contact" data-transition="Contact" class="js-hover-scramble">Contact</a>
      </nav>
      <div class="nav__time mono"><span class="dot"></span><span class="js-clock">--:--</span> IST</div>
    </header>

    <main id="top" class="cs" data-accent="${p.accent}">
      <section class="cs-hero" data-shape="${p.shape}" data-theme="dark">
        <a class="cs-back mono js-hero-fade" href="/#work" data-transition="Selected work">← All work</a>
        <div class="cs-hero__main">
          <p class="chapter__label mono js-decode">${esc(p.label)}</p>
          <h1 class="cs-title" aria-label="${esc(title)}">
            <span class="hero__name-inner">${layer('hero__layer--cipher')}${layer('hero__layer--plain')}</span>
          </h1>
          <p class="cs-summary js-hero-fade">${esc(p.summary)}</p>
        </div>
        <dl class="cs-meta mono js-hero-fade">
          <div><dt>Year</dt><dd>${esc(p.year)}</dd></div>
          <div><dt>Discipline</dt><dd>${esc(p.label)}</dd></div>
          <div><dt>Stack</dt><dd>${esc(p.stackShort)}</dd></div>
          <div><dt>Links</dt><dd>${p.links.map((l) => `<a href="${l.href}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join('<br />')}</dd></div>
        </dl>
      </section>

      <section class="cs-cover" data-shape="${p.shape}" data-theme="dark">
        <figure class="shot js-shot">${frame(p.cover, 'cs-cover__frame')}</figure>
      </section>

      <section class="cs-overview" data-theme="dark">
        <div class="cs-overview__col">
          <p class="eyebrow mono js-decode">The problem</p>
          <p class="cs-lead js-fade">${esc(p.problem)}</p>
        </div>
        <div class="cs-overview__col">
          <p class="eyebrow mono js-decode">What I built</p>
          <p class="cs-body js-fade">${esc(p.built)}</p>
        </div>
      </section>

      <section class="cs-flow" data-theme="light">
        <p class="eyebrow mono js-decode">Sequence</p>
        <h2 class="cs-h2 js-lines">${esc(p.flowTitle)}</h2>
        <ol class="cs-flow__list">
          ${p.flow.map(([h, d], k) => `<li class="cs-step js-step"><span class="cs-step__n">${String(k + 1).padStart(2, '0')}</span><h3 class="cs-step__title">${esc(h)}</h3><p class="cs-step__text">${esc(d)}</p></li>`).join('\n          ')}
        </ol>
      </section>

      <section class="cs-figures" data-theme="light">
        ${p.figures.map(([n, l]) => `<div class="cs-figure js-figure"><span class="cs-figure__n">${esc(n)}</span><span class="cs-figure__l mono">${esc(l)}</span></div>`).join('\n        ')}
      </section>

      <section class="cs-decisions" data-theme="dark">
        <p class="eyebrow mono js-decode">${esc(p.decisionsTitle)}</p>
        <div class="cs-decisions__grid">
          ${p.decisions.map(([h, d]) => `<article class="cs-decision js-fade"><h3>${esc(h)}</h3><p>${esc(d)}</p></article>`).join('\n          ')}
        </div>
      </section>
${p.gallery.length ? `
      <section class="cs-gallery" data-theme="dark">
        ${p.gallery.map((g) => `<figure class="shot js-shot ${g.wide ? 'cs-gallery__wide' : ''}">${frame(g, 'shot__frame--auto')}<figcaption class="mono">${esc(g.caption)}</figcaption></figure>`).join('\n        ')}
      </section>` : ''}

      <section class="cs-stack" data-theme="dark">
        <p class="eyebrow mono js-decode">Built with</p>
        <dl class="spec__table cs-stack__table mono js-stagger">
          ${p.stack.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('\n          ')}
        </dl>
        <div class="spec__links">
          ${p.links.map((l, k) => `<a class="btn ${k ? 'btn--ghost' : ''}" href="${l.href}" target="_blank" rel="noopener" data-magnetic>${esc(l.label)} <span>↗</span></a>`).join('\n          ')}
        </div>
      </section>

      <section class="cs-next" data-shape="${next.shape}" data-theme="dark">
        <a href="/projects/${next.slug}/" data-transition="${esc(next.title.join(' '))}" class="cs-next__link" data-cursor="Next">
          <span class="eyebrow mono">Next project</span>
          <span class="cs-next__title">${next.title.map(esc).join('<br />')}</span>
          <span class="cs-next__label mono">${esc(next.label)}</span>
        </a>
        <footer class="footer mono">
          <span>© 2026 Booveshwaran T</span>
          <a href="/" data-transition="Home" class="js-hover-scramble">Home</a>
          <a href="#top" class="js-hover-scramble">Back to top ↑</a>
        </footer>
      </section>
    </main>

    <script type="module" src="/src/main.js"></script>
  </body>
</html>
`
}

projects.forEach((p, i) => {
  const out = resolve(root, 'projects', p.slug, 'index.html')
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, page(p, i))
})
console.log(`Generated ${projects.length} case-study pages.`)
