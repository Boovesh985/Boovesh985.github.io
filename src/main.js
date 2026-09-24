import '@fontsource/big-shoulders-display/800'
import '@fontsource/big-shoulders-display/900'
import '@fontsource/hanken-grotesk/400'
import '@fontsource/hanken-grotesk/500'
import '@fontsource/martian-mono/400'
import './style.css'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import Lenis from 'lenis'
import { GL } from './gl/gl.js'
import { initCursor } from './lib/cursor.js'
import { initMagnetic } from './lib/magnetic.js'
import { scramble, cipherString } from './lib/scramble.js'
import { initDecrypt } from './lib/decrypt.js'
import { initTransitions } from './lib/transition.js'

gsap.registerPlugin(ScrollTrigger, SplitText)

const html = document.documentElement
const body = document.body
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
const touch = matchMedia('(hover: none)').matches
const $ = (s, r = document) => r.querySelector(s)
const $$ = (s, r = document) => [...r.querySelectorAll(s)]

if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

/* ---------- Smooth scroll ---------- */
const lenis = new Lenis({ lerp: reduced ? 1 : 0.085, smoothWheel: !reduced })
lenis.on('scroll', ScrollTrigger.update)
gsap.ticker.add((t) => lenis.raf(t * 1000))
gsap.ticker.lagSmoothing(0)
if (import.meta.env.DEV) window.__lenis = lenis

$$('a[href^="#"]').forEach((a) =>
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href')
    const target = id === '#top' || id === '#' ? 0 : $(id)
    if (target === null) return
    e.preventDefault()
    lenis.scrollTo(target, { duration: 1.6 })
  })
)

/* ---------- WebGL ---------- */
let gl = null
try {
  const firstShape = Number($('[data-shape]:not(body)')?.dataset.shape ?? 0)
  gl = new GL($('.gl'), { shape: firstShape, reduced, page: body.dataset.page })
  gl.pMat.uniforms.uTheme.value = html.dataset.theme === 'dark' ? 1 : 0
} catch (err) {
  console.warn('WebGL unavailable, continuing without particles.', err)
}
lenis.on('scroll', ({ velocity }) => { if (gl) gl.scrollVel = velocity })

/* ---------- Transitions, cursor, magnetic ---------- */
const transitions = initTransitions({ reduced, onLeave: () => gl?.burst(1.1) })
initCursor()
initMagnetic()

/* ---------- Theme: a circle of the new colour sweeps in behind everything ---------- */
const themeMeta = $('meta[name="theme-color"]')
const wipe = $('.wipe')
const BG = { light: '#d3d6d8', dark: '#0e1114' }
let wipeTween = null
function setTheme(t) {
  const prev = html.dataset.theme
  if (prev === t) return
  html.dataset.theme = t
  gl?.setTheme(t === 'dark')
  themeMeta?.setAttribute('content', BG[t])
  if (reduced || !wipe) { html.style.setProperty('--page-bg', BG[t]); return }
  wipeTween?.progress(1)
  html.style.setProperty('--page-bg', BG[prev])
  const origin = `50% ${lenis.direction < 0 ? 0 : 100}%`
  wipe.style.background = BG[t]
  wipe.style.visibility = 'visible'
  wipeTween = gsap.fromTo(wipe, { clipPath: `circle(0% at ${origin})` }, {
    clipPath: `circle(150% at ${origin})`, duration: 0.95, ease: 'power3.inOut',
    onComplete: () => { html.style.setProperty('--page-bg', BG[t]); wipe.style.visibility = 'hidden'; wipeTween = null },
  })
}

// Whichever section sits under the viewport's midline decides theme, shape and particle opacity.
function sectionTriggers() {
  const themed = $$('main [data-theme]')
  const shaped = $$('main [data-shape]')
  const dimmed = $$('.about, .chapter__body, .archive, .stack, .edu, .cs-cover, .cs-overview, .cs-flow, .cs-figures, .cs-decisions, .cs-gallery, .cs-stack')
  const at = (list, y) => {
    let hit = null
    for (const el of list) {
      const r = el.getBoundingClientRect()
      if (r.top <= y && r.bottom > y) hit = el // later (inner) matches win
    }
    return hit
  }
  let shape = -1, dim = null
  const probe = () => {
    const mid = innerHeight * 0.5
    const t = at(themed, mid)
    if (t) setTheme(t.dataset.theme)
    const s = at(shaped, innerHeight * 0.55)
    if (s && +s.dataset.shape !== shape) { shape = +s.dataset.shape; gl?.setShape(shape) }
    const d = !!at(dimmed, mid)
    if (d !== dim) { dim = d; gl?.setOpacity(d ? (html.dataset.theme === 'dark' ? 0.12 : 0.16) : 1) }
  }
  lenis.on('scroll', probe)
  window.addEventListener('resize', probe)
  probe()
}

/* ---------- Roll-text hover: letters roll up to reveal a copy ---------- */
function rollText() {
  $$('.js-roll').forEach((el) => {
    const text = el.textContent.trim()
    const chars = [...text].map((c, i) => `<span class="roll__c" style="--i:${i}">${c === ' ' ? '&nbsp;' : c}</span>`).join('')
    el.innerHTML = `<span class="sr-only">${text}</span><span class="roll" aria-hidden="true">${chars}</span>`
  })
}

/* ---------- Scroll reveals ---------- */
function reveals() {
  const once = { start: 'top 86%', once: true }

  $$('.js-lines').forEach((el) => {
    const split = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'line' })
    gsap.from(split.lines, { yPercent: 115, rotate: 3, duration: 1.3, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: el, ...once } })
  })

  $$('.js-words').forEach((el) => {
    const split = SplitText.create(el, { type: 'words', wordsClass: 'word' })
    gsap.fromTo(split.words, { opacity: 0.12, y: 12 }, {
      opacity: 1, y: 0, ease: 'none', stagger: 0.1,
      scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 60%', scrub: true },
    })
  })

  $$('.js-fade').forEach((el) =>
    gsap.from(el, { y: 40, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, ...once } })
  )

  $$('.js-stagger').forEach((el) =>
    gsap.from(el.children, { y: 24, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.07, scrollTrigger: { trigger: el, ...once } })
  )

  $$('main .js-decode').forEach((el) => {
    if (el.closest('.hero, .cs-hero')) return
    el.style.visibility = 'hidden'
    ScrollTrigger.create({ trigger: el, ...once, onEnter: () => { el.style.visibility = ''; scramble(el, { duration: 1 }) } })
  })

  // Capability cards rise in with a slight 3D fold
  const caps = $$('.js-cap')
  if (caps.length) {
    gsap.from(caps, {
      y: 80, opacity: 0, rotationX: -18, transformPerspective: 900, transformOrigin: '50% 100%',
      duration: 1.3, ease: 'expo.out', stagger: 0.12, scrollTrigger: { trigger: caps[0], start: 'top 88%', once: true },
    })
  }

  // Archive rows slide in one after another
  const rows = $$('.archive .row')
  if (rows.length) {
    gsap.from(rows, { y: 50, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: rows[0], start: 'top 90%', once: true } })
  }

  $$('.js-shot').forEach((fig) => {
    const frame = $('.shot__frame', fig)
    const img = $('img', fig)
    gsap.fromTo(frame, { clipPath: 'inset(100% 0% 0% 0% round 6px)' }, {
      clipPath: 'inset(0% 0% 0% 0% round 6px)', duration: 1.5, ease: 'expo.inOut', scrollTrigger: { trigger: fig, start: 'top 85%', once: true },
    })
    gsap.fromTo(img, { scale: 1.3 }, { scale: 1, duration: 1.8, ease: 'expo.out', scrollTrigger: { trigger: fig, start: 'top 85%', once: true } })
    if (!frame.classList.contains('shot__frame--paper')) {
      gsap.fromTo(img, { yPercent: -5 }, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: fig, start: 'top bottom', end: 'bottom top', scrub: true } })
    }
  })

  // Chapter titles drift slower than the page (parallax depth)
  if (!reduced) {
    $$('.chapter__title, .work__title, .contact__title').forEach((t) =>
      gsap.fromTo(t, { y: 50 }, { y: -50, ease: 'none', scrollTrigger: { trigger: t, start: 'top bottom', end: 'bottom top', scrub: true } })
    )
  }

  $$('.js-step').forEach((step) => {
    gsap.fromTo(step, { '--p': 0 }, { '--p': 1, ease: 'none', scrollTrigger: { trigger: step, start: 'top 85%', end: 'top 45%', scrub: true } })
    gsap.from(step.children, { y: 30, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.06, scrollTrigger: { trigger: step, start: 'top 82%', once: true } })
  })

  $$('.js-figure').forEach((fig) => {
    const n = $('.cs-figure__n', fig)
    const m = n.textContent.match(/^([^\d]*)([\d.,]+)(.*)$/)
    gsap.from(fig, { y: 40, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: fig, start: 'top 88%', once: true } })
    if (!m || reduced) return
    const [, pre, raw, post] = m
    const grouped = raw.includes(',')
    const num = parseFloat(raw.replace(/,/g, ''))
    const dec = (raw.split('.')[1] || '').length
    const fmt = (v) => (grouped ? Math.round(v).toLocaleString('en-US') : v.toFixed(dec))
    const o = { v: 0 }
    n.textContent = pre + fmt(0) + post
    gsap.to(o, {
      v: num, duration: 1.8, ease: 'power3.out',
      scrollTrigger: { trigger: fig, start: 'top 88%', once: true },
      onUpdate: () => { n.textContent = pre + fmt(o.v) + post },
    })
  })
}

/* ---------- Case study: cover opens up as you scroll; gallery scrolls sideways ---------- */
function caseStudy() {
  const cover = $('.js-cover')
  if (cover) {
    const frame = $('.shot__frame', cover)
    const img = $('img', cover)
    const st = { trigger: cover, start: 'top 95%', end: 'top 18%', scrub: 0.6 }
    gsap.fromTo(frame, { clipPath: 'inset(12% 16% 12% 16% round 18px)' }, { clipPath: 'inset(0% 0% 0% 0% round 6px)', ease: 'none', scrollTrigger: st })
    gsap.fromTo(img, { scale: 1.35 }, { scale: 1, ease: 'none', scrollTrigger: { ...st } })
  }

  const sec = $('.cs-gallery')
  if (!sec) return
  const track = $('.cs-gallery__track', sec)
  const count = $('.js-gcount', sec)
  const figs = $$('.hfig', sec)
  gsap.matchMedia().add('(min-width: 901px)', () => {
    const pad = () => parseFloat(getComputedStyle(sec).paddingLeft) || 0
    const dist = () => Math.max(0, track.scrollWidth - (innerWidth - pad() * 2))
    if (dist() < 40) return
    const tween = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: sec, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.8, invalidateOnRefresh: true,
        onUpdate: (self) => { count.textContent = String(Math.min(figs.length, Math.floor(self.progress * figs.length) + 1)).padStart(2, '0') },
      },
    })
    figs.forEach((f) => gsap.fromTo(f, { opacity: 0.3, scale: 0.9 }, {
      opacity: 1, scale: 1, ease: 'none',
      scrollTrigger: { trigger: f, containerAnimation: tween, start: 'left 100%', end: 'left 60%', scrub: true },
    }))
  })
}

/* ---------- Hover: 3D tilt + glare on screenshots, spotlight on cards ---------- */
function tilt() {
  if (touch || reduced) return
  const bind = (el, max, onMove) => {
    gsap.set(el, { transformPerspective: 1200 })
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.8, ease: 'power3.out' })
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.8, ease: 'power3.out' })
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height
      ry((px - 0.5) * max); rx(-(py - 0.5) * max)
      onMove(px, py)
    })
    el.addEventListener('pointerleave', () => { rx(0); ry(0) })
  }
  $$('.js-shot .shot__frame').forEach((frame) => {
    const glare = document.createElement('span')
    glare.className = 'shot__glare'
    frame.appendChild(glare)
    bind(frame, 7, (px, py) => { frame.style.setProperty('--gx', `${px * 100}%`); frame.style.setProperty('--gy', `${py * 100}%`) })
  })
  $$('.js-cap').forEach((card) =>
    bind(card, 6, (px, py) => { card.style.setProperty('--mx', `${px * 100}%`); card.style.setProperty('--my', `${py * 100}%`) })
  )
}

// Screenshots lean with scroll speed, then settle.
function velocitySkew() {
  if (reduced) return
  const shots = $$('.js-shot')
  if (!shots.length) return
  let sk = 0, last = 0
  gsap.ticker.add(() => {
    sk += (gsap.utils.clamp(-3, 3, lenis.velocity * 0.12) - sk) * 0.12
    if (Math.abs(sk - last) < 0.01) return
    last = sk
    for (const s of shots) s.style.transform = `skewY(${sk.toFixed(3)}deg)`
  })
}

// Hovering a project flings the particles outward.
function bursts() {
  let t = 0
  $$('[data-burst]').forEach((el) => el.addEventListener('pointerenter', () => {
    const now = performance.now()
    if (now - t < 500) return
    t = now
    gl?.burst(0.4)
  }))
}

/* ---------- Hover scramble on small labels ---------- */
$$('.js-hover-scramble').forEach((el) => {
  if (el.children.length) return
  el.addEventListener('pointerenter', () => scramble(el, { duration: 0.45 }))
})

/* ---------- IST clock ---------- */
const clock = $('.js-clock')
if (clock) {
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })
  const tick = () => { clock.textContent = fmt.format(new Date()) }
  tick(); setInterval(tick, 15000)
}

/* ---------- Hero name: fit to width ---------- */
function fitName() {
  const h = $('.hero__name')
  if (!h) return
  const layer = $('.hero__layer--cipher', h)
  h.style.fontSize = '100px'
  const range = document.createRange()
  range.selectNodeContents(layer)
  const w = range.getBoundingClientRect().width
  const avail = h.clientWidth
  h.style.fontSize = `${(100 * avail * 0.985) / w}px`
}

// The hero drifts apart as you scroll away from it.
function heroParallax() {
  const hero = $('.hero')
  if (!hero || reduced) return
  const st = { trigger: hero, start: 'top top', end: 'bottom top', scrub: true }
  gsap.to($('.hero__name'), { yPercent: 22, opacity: 0.2, ease: 'none', scrollTrigger: st })
  gsap.to($('.hero__top'), { y: -80, opacity: 0, ease: 'none', scrollTrigger: { ...st, end: '60% top' } })
  gsap.to($('.hero__bottom'), { opacity: 0, ease: 'none', scrollTrigger: { ...st, end: '25% top' } })
}

/* ---------- Home: marquee, archive preview, email ---------- */
function marquee() {
  $$('.marquee__row').forEach((row) => {
    const dir = Number(row.dataset.dir) || 1
    let x = dir > 0 ? 0 : -50
    let skew = 0
    gsap.ticker.add(() => {
      const v = reduced ? 0 : lenis.velocity
      x -= (0.025 + Math.min(Math.abs(v) * 0.01, 0.6)) * dir
      if (x <= -50) x += 50
      if (x > 0) x -= 50
      skew += (gsap.utils.clamp(-8, 8, -v * 0.25) - skew) * 0.1
      row.style.transform = `translate3d(${x}%,0,0) skewX(${skew}deg)`
    })
  })
}

function archivePreview() {
  const preview = $('.preview')
  const list = $('.archive__list')
  if (!preview || !list || touch) return
  const track = $('.preview__track', preview)

  // Flood-mask preview: a procedural three-class segmentation map
  const grid = $('.pv-flood__grid')
  if (grid) {
    const cols = ['#27402d', '#2f63c2', '#8cc7e6']
    let cells = ''
    for (let y = 0; y < 18; y++) for (let x = 0; x < 24; x++) {
      const river = Math.abs(y - (9 + Math.sin(x * 0.45) * 4)) < 1.4
      const flood = Math.sin(x * 0.3 + y * 0.2) + Math.cos(y * 0.5 - x * 0.12) > 1.1
      cells += `<i style="background:${cols[river ? 2 : flood ? 1 : 0]}"></i>`
    }
    grid.innerHTML = cells
  }

  const pos = { x: innerWidth / 2, y: innerHeight / 2 }
  const cur = { ...pos }
  let shown = false
  window.addEventListener('pointermove', (e) => { pos.x = e.clientX; pos.y = e.clientY }, { passive: true })
  const setX = gsap.quickSetter(preview, 'x', 'px')
  const setY = gsap.quickSetter(preview, 'y', 'px')
  const setR = gsap.quickSetter(preview, 'rotation', 'deg')
  gsap.ticker.add(() => {
    if (!shown && Math.abs(pos.x - cur.x) < 0.5) return
    const dx = pos.x - cur.x
    cur.x += dx * 0.12
    cur.y += (pos.y - cur.y) * 0.12
    setX(cur.x + 36); setY(cur.y - preview.offsetHeight / 2); setR(gsap.utils.clamp(-12, 12, dx * 0.08))
  })
  $$('.row', list).forEach((row, i) => {
    row.addEventListener('pointerenter', () => {
      gsap.to(track, { yPercent: -100 * i, duration: shown ? 0.8 : 0, ease: 'expo.out' })
      if (!shown) gsap.to(preview, { opacity: 1, scale: 1, duration: 0.6, ease: 'expo.out' })
      shown = true
    })
  })
  list.addEventListener('pointerleave', () => {
    shown = false
    gsap.to(preview, { opacity: 0, scale: 0.6, duration: 0.5, ease: 'expo.out' })
  })
}

function emailCopy() {
  const btn = $('.contact__email')
  if (!btn) return
  const note = $('.contact__email-note', btn)
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.email)
      note.textContent = 'Copied to clipboard'
    } catch {
      location.href = `mailto:${btn.dataset.email}`
      return
    }
    scramble(note, { duration: 0.5 })
    setTimeout(() => { note.dataset.text = 'Copy email'; note.textContent = 'Copy email' }, 2200)
  })
}

/* ---------- Loader (home, first arrival only) ---------- */
async function runLoader(onReveal) {
  const loader = $('.loader')
  if (!loader) { onReveal(); return }
  if (transitions.arriving || reduced) { loader.remove(); onReveal(); return }
  body.classList.add('is-loading')
  lenis.stop()
  const digits = $('.loader__digits', loader)
  const cipher = $('.loader__cipher', loader)
  const content = $('.loader__content', loader)
  const cols = $$('.loader__cols i', loader)
  const c = { v: 0 }
  const draw = () => {
    digits.textContent = String(Math.round(c.v)).padStart(3, '0')
    digits.style.setProperty('--fill', `${c.v}%`)
  }
  const noise = setInterval(() => { cipher.textContent = cipherString(14) }, 70)
  const fontsReady = document.fonts.ready
  await gsap.to(c, { v: 84, duration: 1.7, ease: 'power2.inOut', onUpdate: draw })
  await fontsReady
  await gsap.to(c, { v: 100, duration: 0.45, ease: 'power2.out', onUpdate: draw })
  clearInterval(noise)
  cipher.dataset.text = 'Decrypted'
  scramble(cipher, { duration: 0.4 })
  const tl = gsap.timeline({ delay: 0.3 })
  tl.to(content, { yPercent: -6, opacity: 0, duration: 0.6, ease: 'power2.in' })
    .to(cols, { scaleY: 0, duration: 1.1, ease: 'expo.inOut', stagger: { each: 0.07, from: 'center' } }, '-=0.15')
    .add(onReveal, '-=0.85')
  await tl
  loader.remove()
  body.classList.remove('is-loading')
  lenis.start()
}

/* ---------- Page intro ---------- */
function heroIntro() {
  const hero = $('.hero, .cs-hero')
  if (!hero) return
  const nameInner = $('.hero__name-inner', hero)
  const decrypt = initDecrypt(hero, gl)
  gl?.intro(2.8)
  const tl = gsap.timeline({ onComplete: heroParallax })
  tl.from(nameInner, { yPercent: 105, duration: 1.4, ease: 'expo.out' })
    .from($$('.js-hero-fade', hero), { y: 24, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.08 }, 0.25)
    .from('.nav', { y: -20, opacity: 0, duration: 1, ease: 'expo.out' }, 0.3)
  $$('.js-decode', hero).forEach((el, i) => tl.add(() => scramble(el, { duration: 1.1 }), 0.35 + i * 0.12))
  if (!reduced) tl.add(() => decrypt.sweep(1.9), 0.75)

  // Touch devices have no hover trail: repeat the sweep while the hero is on screen.
  if (touch && !reduced) {
    let visible = true
    new IntersectionObserver(([e]) => { visible = e.isIntersecting }).observe(hero)
    setInterval(() => visible && decrypt.sweep(1.9), 7000)
  }
}

/* ---------- Boot ---------- */
document.fonts.load('900 100px "Big Shoulders Display"').then(() => { fitName(); ScrollTrigger.refresh() })
fitName()
window.addEventListener('resize', fitName)

rollText()
sectionTriggers()
marquee()
archivePreview()
emailCopy()
tilt()
velocitySkew()
bursts()

document.fonts.ready.then(() => {
  reveals()
  caseStudy()
  ScrollTrigger.refresh()
})

if (location.hash && $(location.hash)) lenis.scrollTo($(location.hash), { immediate: true, force: true })
if (transitions.arriving) {
  $('.loader')?.remove()
  transitions.arrive().then(heroIntro)
} else {
  runLoader(heroIntro)
}
