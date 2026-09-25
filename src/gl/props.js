import {
  ACESFilmicToneMapping, BackSide, BufferAttribute, BufferGeometry, CanvasTexture, Color, ConeGeometry, CylinderGeometry, DirectionalLight,
  DoubleSide, Euler, Group, HemisphereLight, IcosahedronGeometry, InstancedMesh, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Object3D, PerspectiveCamera, PlaneGeometry, PMREMGenerator, Scene, SphereGeometry, SRGBColorSpace, TorusGeometry,
  Vector3, WebGLRenderer,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import gsap from 'gsap'
import { createAstronaut, POSES } from './astronaut.js'

/*
  Small 3D objects that live inside page elements ([data-prop="kind"]).
  Each gets its own canvas sized to its box, so nothing can spill over the text around it,
  and it only renders while on screen.
*/

const TAU = Math.PI * 2
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const smooth = (t) => t * t * (3 - 2 * t)
const C = { straw: '#e2b04f', bronze: '#c46a34', violet: '#8a5ed0', blue: '#2f63c2', frost: '#dfe6ee', ink: '#15191e' }

const mat = {
  steel: () => new MeshStandardMaterial({ color: 0xa3a9b0, metalness: 0.88, roughness: 0.3 }),
  ink: () => new MeshStandardMaterial({ color: 0x1b1f24, metalness: 0.45, roughness: 0.4 }),
  white: () => new MeshStandardMaterial({ color: 0xeef0f2, metalness: 0.02, roughness: 0.5 }),
  glow: (hex, k = 1.2) => new MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: k, roughness: 0.35, metalness: 0.1 }),
}

// Reflections: a dark room with temper-coloured light strips.
function makeEnv(renderer) {
  const env = new Scene()
  env.add(new Mesh(new SphereGeometry(10, 24, 12), new MeshBasicMaterial({ color: 0x0b0c0f, side: BackSide })))
  const strip = (color, w, h, pos, k) => {
    const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: new Color(color).multiplyScalar(k), side: DoubleSide }))
    m.position.set(...pos); m.lookAt(0, 0, 0)
    env.add(m)
  }
  strip('#ffffff', 9, 3, [0, 7, 3], 2.4)
  strip('#ffffff', 5, 5, [5, 2, 6], 1.2)
  strip(C.straw, 1.2, 8, [-7, 1, 3], 2.5)
  strip(C.blue, 1.2, 8, [7, 0, -2], 3)
  strip(C.violet, 9, 1, [0, -6, 3], 1.6)
  const pm = new PMREMGenerator(renderer)
  const tex = pm.fromScene(env, 0.03).texture
  pm.dispose()
  return tex
}

function textTexture(label, { bg = null, fg = '#0e1114', font = '800 150px "Big Shoulders Display", sans-serif', size = 256 } = {}) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const x = c.getContext('2d')
  if (bg) { x.fillStyle = bg; x.fillRect(0, 0, size, size) }
  x.fillStyle = fg
  x.font = font
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  x.fillText(label, size / 2, size / 2 + size * 0.04)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}

/* ---------- Kinds ---------- */

// AI & LLM: a core with five agents orbiting it, messages running along the links.
function agents() {
  const g = new Group()
  const core = new Mesh(new IcosahedronGeometry(0.6, 1), new MeshStandardMaterial({ color: 0x23282e, metalness: 0.9, roughness: 0.22, flatShading: true }))
  const shell = new Mesh(new IcosahedronGeometry(0.74, 1), new MeshBasicMaterial({ color: C.straw, wireframe: true, transparent: true, opacity: 0.45 }))
  g.add(core, shell)
  const cols = [C.straw, C.bronze, C.violet, C.blue, C.frost]
  const nodes = cols.map((c, i) => {
    const m = new Mesh(new SphereGeometry(0.16, 24, 16), mat.glow(c, 0.7))
    const tilt = new Euler(0.35 + i * 0.5, i * 1.3, (i % 2 ? 1 : -1) * 0.3)
    const r = 1.35 + (i % 2) * 0.28
    const ring = new Mesh(new TorusGeometry(r, 0.006, 6, 96), new MeshBasicMaterial({ color: 0x8a9199, transparent: true, opacity: 0.4 }))
    ring.rotation.copy(tilt); ring.rotateX(Math.PI / 2)
    g.add(m, ring)
    return { m, tilt, r, a: (i / cols.length) * TAU, speed: 0.4 + i * 0.09 }
  })
  const pos = new Float32Array(20 * 3)
  const lineGeo = new BufferGeometry()
  lineGeo.setAttribute('position', new BufferAttribute(pos, 3))
  const lines = new LineSegments(lineGeo, new LineBasicMaterial({ color: 0x8a9199, transparent: true, opacity: 0.55 }))
  lines.frustumCulled = false
  g.add(lines)
  const packets = nodes.map(() => { const p = new Mesh(new SphereGeometry(0.045, 10, 8), mat.glow(C.straw, 2)); g.add(p); return p })
  const v = new Vector3()
  let tt = 0
  return {
    group: g, radius: 1.55,
    update(t, dt, s) {
      tt += dt * (1 + s.hover * 1.6)
      nodes.forEach((n, i) => {
        n.a += dt * n.speed * (1 + s.hover * 1.4)
        const r = n.r * (1 + s.hover * 0.12)
        v.set(Math.cos(n.a) * r, 0, Math.sin(n.a) * r).applyEuler(n.tilt)
        n.m.position.copy(v)
        pos.set([0, 0, 0, v.x, v.y, v.z], i * 6)
        const next = nodes[(i + 1) % nodes.length].m.position
        pos.set([v.x, v.y, v.z, next.x, next.y, next.z], 30 + i * 6)
        const f = (tt * 0.8 + i * 0.37) % 1
        packets[i].position.copy(v).multiplyScalar(i % 2 ? f : 1 - f)
      })
      lineGeo.attributes.position.needsUpdate = true
      core.rotation.y += dt * 0.35; core.rotation.x += dt * 0.12
      shell.rotation.y -= dt * 0.2
      g.rotation.set(0.25 - s.my * 0.35, s.mx * 0.6, 0)
    },
  }
}

// Machine learning: feature maps shrinking through a CNN, an activation wave running through them.
function cnn() {
  const g = new Group()
  const layers = [[7, 7, -1.75], [5, 5, -0.6], [4, 4, 0.45], [5, 1, 1.5]]
  const cells = []
  layers.forEach(([ny, nz, x], li) => {
    for (let a = 0; a < ny; a++) for (let b = 0; b < nz; b++) cells.push({ li, p: [x, (a - (ny - 1) / 2) * 0.26, (b - (nz - 1) / 2) * 0.26] })
  })
  const box = new RoundedBoxGeometry(0.19, 0.19, 0.19, 2, 0.03)
  const im = new InstancedMesh(box, new MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.2 }), cells.length)
  const d = new Object3D()
  cells.forEach((c, i) => {
    d.position.set(...c.p)
    if (c.li === 3) d.scale.set(1.5, 1.5, 1.5); else d.scale.set(0.55, 1, 1)
    d.updateMatrix(); im.setMatrixAt(i, d.matrix)
    im.setColorAt(i, new Color(0x2f63c2))
  })
  g.add(im)
  // frustum lines between consecutive maps
  const seg = []
  for (let i = 0; i < layers.length - 1; i++) {
    const [ay, az, ax] = layers[i], [by, bz, bx] = layers[i + 1]
    ;[[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sy, sz]) => {
      seg.push(ax, sy * (ay - 1) * 0.13, sz * (az - 1) * 0.13, bx, sy * (by - 1) * 0.13, sz * (bz - 1) * 0.13)
    })
  }
  const lg = new BufferGeometry()
  lg.setAttribute('position', new BufferAttribute(new Float32Array(seg), 3))
  g.add(new LineSegments(lg, new LineBasicMaterial({ color: 0x8a9199, transparent: true, opacity: 0.5 })))
  const base = new Color(C.blue), hot = new Color(C.straw), out = new Color(C.bronze), tmp = new Color()
  let tt = 0
  return {
    group: g, radius: 1.55,
    update(t, dt, s) {
      tt += dt * (1 + s.hover * 1.8)
      cells.forEach((c, i) => {
        const ph = ((tt * 0.9 - c.li * 0.42) % 2.2 + 2.2) % 2.2
        const k = Math.exp(-Math.pow((ph - 0.5) * 3.2, 2)) * (0.55 + 0.45 * Math.sin(i * 12.9898))
        if (c.li === 3) tmp.copy(base).lerp(i % 5 === 2 ? hot : out, k * (i % 5 === 2 ? 1.6 : 0.5))
        else tmp.copy(base).lerp(hot, clamp(k, 0, 1))
        im.setColorAt(i, tmp)
      })
      im.instanceColor.needsUpdate = true
      g.rotation.set(0.3 - s.my * 0.3, -0.62 + s.mx * 0.55 + Math.sin(t * 0.3) * 0.08, 0)
    },
  }
}

// Full-stack: interface, API and database layers that pull apart when you hover.
function stack() {
  const g = new Group()
  const slab = new RoundedBoxGeometry(2.1, 0.24, 1.45, 4, 0.08)
  // interface screen texture
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 340
  const x = cv.getContext('2d')
  x.fillStyle = '#0e1114'; x.fillRect(0, 0, 512, 340)
  x.fillStyle = C.straw; x.fillRect(24, 22, 180, 22)
  x.fillStyle = '#3a4048'; x.fillRect(360, 24, 128, 18)
  x.fillStyle = '#20252b'; [[24, 70], [186, 70], [348, 70]].forEach(([a, b]) => x.fillRect(a, b, 140, 150))
  x.fillStyle = C.bronze; x.fillRect(24, 250, 150, 44)
  x.fillStyle = '#3a4048'; x.fillRect(200, 262, 280, 18)
  const tex = new CanvasTexture(cv); tex.colorSpace = SRGBColorSpace
  const top = new Group()
  top.add(new Mesh(slab, mat.white()))
  const screen = new Mesh(new PlaneGeometry(1.78, 1.18), new MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55, roughness: 0.3 }))
  screen.rotation.x = -Math.PI / 2; screen.position.y = 0.122
  top.add(screen)
  const mid = new Group()
  mid.add(new Mesh(slab, mat.steel()))
  const ports = []
  for (let i = 0; i < 6; i++) {
    const p = new Mesh(new RoundedBoxGeometry(0.14, 0.07, 0.04, 2, 0.015), mat.glow(C.bronze, 1))
    p.position.set(-0.6 + i * 0.24, 0, 0.73)
    mid.add(p); ports.push(p)
  }
  const db = new Group()
  const disc = new CylinderGeometry(0.62, 0.62, 0.17, 48)
  for (let i = 0; i < 3; i++) {
    const m = new Mesh(disc, i === 1 ? mat.ink() : mat.white())
    m.position.y = -i * 0.21
    const band = new Mesh(new TorusGeometry(0.625, 0.018, 8, 64), mat.glow(C.blue, 1.4))
    band.rotation.x = Math.PI / 2; band.position.y = -i * 0.21 + 0.09
    db.add(m, band)
  }
  g.add(top, mid, db)
  const packets = [0, 1, 2].map((i) => { const p = new Mesh(new RoundedBoxGeometry(0.1, 0.1, 0.1, 2, 0.02), mat.glow(C.straw, 2)); g.add(p); return { p, o: i / 3 } })
  let tt = 0
  return {
    group: g, radius: 1.45,
    update(t, dt, s) {
      tt += dt * (1 + s.hover)
      const gap = 0.62 + s.hover * 0.3
      top.position.y = gap + Math.sin(t * 1.1) * 0.03
      mid.position.y = Math.sin(t * 1.1 + 1) * 0.03
      db.position.y = -gap + 0.12 + Math.sin(t * 1.1 + 2) * 0.03
      packets.forEach(({ p, o }) => {
        const f = (tt * 0.45 + o) % 1
        p.position.set(0.72, lerp(top.position.y - 0.14, db.position.y + 0.1, f), 0.45)
        p.visible = f > 0.03 && f < 0.97
      })
      ports.forEach((p, i) => { p.material.emissiveIntensity = 0.4 + Math.max(0, Math.sin(tt * 4 - i * 0.8)) * 1.6 })
      g.rotation.set(0.42 - s.my * 0.25, -0.65 + s.mx * 0.55 + Math.sin(t * 0.25) * 0.1, 0)
    },
  }
}
const lerp = (a, b, t) => a + (b - a) * t

// Toolkit: keycaps that type on their own and press down under the cursor.
function keys(prop) {
  const g = new Group()
  const labels = ['Py', 'JS', 'C++', 'SQL', 'API', 'RAG', 'Git', '{ }']
  const bodies = ['#eceef0', C.ink, '#eceef0', C.straw, '#eceef0', C.bronze, C.ink, '#eceef0']
  const cap = new RoundedBoxGeometry(0.92, 0.42, 0.92, 4, 0.13)
  const list = labels.map((l, i) => {
    const dark = bodies[i] === C.ink
    const k = new Group()
    const body = new Mesh(cap, new MeshStandardMaterial({ color: bodies[i], roughness: 0.42, metalness: dark ? 0.3 : 0.05 }))
    const face = new Mesh(new PlaneGeometry(0.72, 0.72), new MeshStandardMaterial({
      map: textTexture(l, { fg: dark ? '#e9e6df' : '#0e1114' }), transparent: true, roughness: 0.5,
      emissive: new Color(C.straw), emissiveIntensity: 0,
    }))
    face.rotation.x = -Math.PI / 2; face.position.y = 0.212
    k.add(body, face)
    const col = i % 4, row = (i / 4) | 0
    k.userData = { x: (col - 1.5) * 1.08 + row * 0.3, z: (row - 0.5) * 1.1, ph: i * 1.7, press: 0, face }
    k.rotation.y = (Math.sin(i * 3.1) * 0.12)
    g.add(k)
    return k
  })
  const v = new Vector3()
  let nextTap = 0
  return {
    group: g, radius: 1.62,
    update(t, dt, s) {
      if (t > nextTap) { // type a key every so often
        nextTap = t + 0.35 + Math.random() * 0.5
        list[(Math.random() * list.length) | 0].userData.press = 1
      }
      list.forEach((k) => {
        const u = k.userData
        k.position.set(u.x, Math.sin(t * 1.3 + u.ph) * 0.06, u.z)
        // press under the cursor
        v.copy(k.position).applyMatrix4(g.matrixWorld).project(prop.camera)
        const near = s.inside && Math.hypot((v.x - s.cx) * prop.aspect, v.y - s.cy) < 0.28
        u.press = Math.max(u.press - dt * 2.6, near ? 1 : 0)
        const p = smooth(clamp(u.press, 0, 1))
        k.position.y -= p * 0.16
        u.face.material.emissiveIntensity = p * 0.9
      })
      g.rotation.set(0.95 - s.my * 0.2, s.mx * 0.35 + Math.sin(t * 0.3) * 0.06, 0)
    },
  }
}

// Education: a mortarboard whose tassel swings as it turns.
function grad() {
  const g = new Group()
  const board = new Mesh(new RoundedBoxGeometry(1.9, 0.07, 1.9, 2, 0.025), new MeshStandardMaterial({ color: 0x1b1f24, roughness: 0.55, metalness: 0.2 }))
  board.rotation.y = Math.PI / 4
  const skull = new Mesh(new CylinderGeometry(0.62, 0.7, 0.55, 48, 1, true), new MeshStandardMaterial({ color: 0x23282e, roughness: 0.6, side: DoubleSide }))
  skull.position.y = -0.3
  const band = new Mesh(new TorusGeometry(0.7, 0.03, 8, 64), mat.glow(C.bronze, 0.4))
  band.rotation.x = Math.PI / 2; band.position.y = -0.56
  const button = new Mesh(new SphereGeometry(0.07, 16, 12), mat.glow(C.straw, 0.6))
  button.position.y = 0.06
  g.add(board, skull, band, button)
  // tassel: a pivot at the button, a cord to the corner, then a hanging tail
  const corner = new Vector3(0, 0.05, 1.3)
  const cordLen = corner.length()
  const cord = new Mesh(new CylinderGeometry(0.018, 0.018, cordLen, 8), mat.glow(C.straw, 0.35))
  cord.position.copy(corner).multiplyScalar(0.5); cord.rotation.x = Math.PI / 2
  const swing = new Group(); swing.position.copy(corner)
  const tail = new Mesh(new CylinderGeometry(0.018, 0.018, 0.5, 8), mat.glow(C.straw, 0.35)); tail.position.y = -0.25
  const knot = new Mesh(new SphereGeometry(0.05, 12, 8), mat.glow(C.straw, 0.5)); knot.position.y = -0.5
  const tassel = new Mesh(new ConeGeometry(0.1, 0.34, 16, 1, true), mat.glow(C.straw, 0.5)); tassel.position.y = -0.66
  swing.add(tail, knot, tassel)
  const arm = new Group()
  arm.add(cord, swing)
  arm.rotation.y = Math.PI / 4
  g.add(arm)
  // diploma orbiting
  const scroll = new Group()
  scroll.add(new Mesh(new CylinderGeometry(0.1, 0.1, 0.9, 24), new MeshStandardMaterial({ color: 0xefe7d6, roughness: 0.7 })))
  const ribbon = new Mesh(new TorusGeometry(0.105, 0.02, 8, 24), mat.glow(C.bronze, 0.5)); ribbon.rotation.x = Math.PI / 2
  scroll.add(ribbon)
  scroll.rotation.z = Math.PI / 2
  g.add(scroll)
  let sw = 0, swv = 0, prevRy = 0
  return {
    group: g, radius: 1.45,
    update(t, dt, s) {
      const ry = s.mx * 0.9 + t * 0.35
      const rx = 0.42 - s.my * 0.3 + Math.sin(t * 0.8) * 0.05
      // spring the tassel against the turning speed
      const turn = (ry - prevRy) / Math.max(dt, 0.001)
      prevRy = ry
      swv += (-sw * 26 - swv * 3.2 - turn * 0.9) * dt
      sw += swv * dt
      swing.rotation.set(-rx * 0.8, 0, clamp(sw, -1.1, 1.1))
      g.rotation.set(rx, ry, Math.sin(t * 0.6) * 0.05)
      g.position.y = Math.sin(t * 1.2) * 0.06
      const a = t * 0.7
      scroll.position.set(Math.cos(a) * 1.55, -0.35 + Math.sin(a * 2) * 0.12, Math.sin(a) * 1.55)
      scroll.rotation.set(0, -a, Math.PI / 2)
    },
  }
}

// Contact: the astronaut from the dive, back to say hello.
function astro(prop) {
  const env = prop.env
  const A = createAstronaut({ env })
  const g = new Group()
  g.add(A.root)
  A.root.position.y = -0.2
  const orb = new Mesh(new SphereGeometry(0.09, 16, 12), mat.glow(C.straw, 2.4))
  g.add(orb)
  const flip = { t: 0 }
  let tween = null
  return {
    group: g, radius: 1.75,
    click() {
      if (tween?.isActive()) return
      flip.t = 0
      tween = gsap.to(flip, { t: 1, duration: 1.2, ease: 'power2.inOut' })
    },
    update(t, dt, s) {
      const waveCycle = (t % 7) / 7
      const wave = Math.max(s.hover, smooth(clamp((waveCycle - 0.55) * 6, 0, 1)) * smooth(clamp((0.98 - waveCycle) * 6, 0, 1)))
      const f = flip.t, fk = Math.sin(Math.PI * f)
      A.apply([[POSES.idle, 1 - wave], [POSES.wave, wave], [POSES.tuck, fk * 1.5]], (P) => {
        P.neck[1] += s.mx * 0.6 * (1 - fk); P.neck[0] -= s.my * 0.3 * (1 - fk)
        P.spine[1] += s.mx * 0.15
        P.shL[2] += Math.sin(t * 1.1) * 0.08
        P.hipL[0] += Math.sin(t * 1.3) * 0.1; P.hipR[0] -= Math.sin(t * 1.3) * 0.1
        if (wave > 0.01) P.shR[2] += Math.sin(t * 7) * 0.3 * wave
      })
      A.body.rotation.x = f > 0 && f < 1 ? -TAU * (f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2) : 0
      A.root.position.y = -0.2 + Math.sin(t * 0.9) * 0.08 + fk * 0.5
      A.root.rotation.set(s.my * -0.1, s.mx * 0.45 + Math.sin(t * 0.3) * 0.12, Math.sin(t * 0.5) * 0.06, 'YXZ')
      const a = t * 0.8
      orb.position.set(Math.cos(a) * 1.25, 0.6 + Math.sin(a * 1.3) * 0.25, Math.sin(a) * 1.25)
    },
  }
}

const KINDS = { agents, cnn, stack, keys, grad, astro }

/* ---------- Runtime ---------- */

const mouse = { x: -9999, y: -9999 }

class Prop {
  constructor(el, kind, { reduced }) {
    this.el = el
    this.reduced = reduced
    this.visible = true
    const canvas = (this.canvas = document.createElement('canvas'))
    canvas.className = 'prop__gl'
    canvas.setAttribute('aria-hidden', 'true')
    el.appendChild(canvas)
    const r = (this.renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' }))
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    r.setClearColor(0x000000, 0)
    r.toneMapping = ACESFilmicToneMapping
    this.scene = new Scene()
    this.env = makeEnv(r)
    this.scene.environment = this.env
    this.camera = new PerspectiveCamera(28, 1, 0.1, 60)
    this.scene.add(new HemisphereLight(0xffffff, 0x3a3f46, 0.7))
    const key = new DirectionalLight(0xfff1e0, 2.2); key.position.set(3, 5, 5)
    const rim = new DirectionalLight(0x5b8ff0, 2.4); rim.position.set(-4, 2, -4)
    const warm = new DirectionalLight(0xe2b04f, 1.2); warm.position.set(4, -2, -3)
    this.scene.add(key, rim, warm)
    this.obj = KINDS[kind](this)
    this.scene.add(this.obj.group)
    this.state = { mx: 0, my: 0, cx: 0, cy: 0, hover: 0, inside: false }
    this.hoverTarget = 0
    const host = el.closest('[data-prop-host]') || el
    host.addEventListener('pointerenter', () => { this.hoverTarget = 1 })
    host.addEventListener('pointerleave', () => { this.hoverTarget = 0 })
    if (this.obj.click) host.addEventListener('click', (e) => { if (!e.target.closest('a, button')) this.obj.click() })
    new ResizeObserver(() => this.resize()).observe(el)
    this.resize()
    this.start = performance.now()
    this.last = this.start
    this.render(true)
    requestAnimationFrame(() => canvas.classList.add('is-ready'))
  }

  resize() {
    const w = this.el.clientWidth, h = this.el.clientHeight
    if (!w || !h) return
    this.renderer.setSize(w, h, false)
    this.aspect = w / h
    this.camera.aspect = this.aspect
    const half = (this.camera.fov * Math.PI) / 360
    this.camera.position.set(0, 0, (this.obj.radius * 1.08) / Math.tan(half) / Math.min(1, this.aspect))
    this.camera.updateProjectionMatrix()
  }

  render(force = false) {
    const now = performance.now()
    const dt = Math.min((now - this.last) / 1000, 0.1)
    this.last = now
    if (!this.visible && !force) return
    const t = this.reduced ? 0 : (now - this.start) / 1000
    const r = this.el.getBoundingClientRect()
    const s = this.state
    const px = (mouse.x - r.left) / r.width, py = (mouse.y - r.top) / r.height
    s.inside = px >= 0 && px <= 1 && py >= 0 && py <= 1
    s.cx = px * 2 - 1; s.cy = -(py * 2 - 1)
    // look toward the cursor even from outside the box, but gently
    const k = Math.min(1, dt * 4)
    s.mx += (clamp((mouse.x - (r.left + r.width / 2)) / Math.max(r.width, 400), -1, 1) - s.mx) * k
    s.my += (clamp(-(mouse.y - (r.top + r.height / 2)) / Math.max(r.height, 300), -1, 1) - s.my) * k
    s.hover += (this.hoverTarget - s.hover) * Math.min(1, dt * 5)
    this.obj.update(t, this.reduced ? 0 : dt, s)
    this.renderer.render(this.scene, this.camera)
  }
}

export function mountProps({ reduced = false } = {}) {
  const els = [...document.querySelectorAll('[data-prop]')]
  if (!els.length) return
  const props = []
  window.addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY }, { passive: true })
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    const el = e.target
    if (e.isIntersecting && !el._prop) {
      try { el._prop = new Prop(el, el.dataset.prop, { reduced }); props.push(el._prop) } catch (err) { console.warn('3D prop unavailable', err); io.unobserve(el) }
    }
    if (el._prop) el._prop.visible = e.isIntersecting
  }), { rootMargin: '120px 0px' })
  els.forEach((el) => io.observe(el))
  gsap.ticker.add(() => { if (!document.hidden) for (const p of props) p.render() })
}
