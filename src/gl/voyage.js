import {
  AdditiveBlending, BackSide, BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, CircleGeometry, Color, CylinderGeometry,
  DirectionalLight, DoubleSide, Fog, Group, HalfFloatType, HemisphereLight, InstancedMesh, LinearFilter, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, NoBlending, PCFSoftShadowMap, Object3D, OrthographicCamera, PerspectiveCamera, PlaneGeometry, PMREMGenerator, PointLight, Points,
  Quaternion, Scene, ShaderMaterial, SphereGeometry, SRGBColorSpace, TorusGeometry, Vector3, WebGLRenderTarget, WebGLRenderer,
} from 'three'
import gsap from 'gsap'
import { createAstronaut, POSES } from './astronaut.js'

/*
  The Voyage: a scroll-driven dive through the stack.
  progress 0 → 1 (the section's sticky travel):
    0.00–0.16  space: the astronaut floats, follows the cursor, the word DIVE rises behind
    0.16–0.30  launch: crouch, spring, backflip through the letters
    0.30–0.84  tunnel: five layers (interface, services, data, models, ciphertext)
    0.84–1.00  exit: a wave goodbye, a flash of light, fade to ink
*/

// color: the layer's light; fog: the haze it fades into (sRGB)
export const LAYERS = [
  { name: 'Interface', color: '#e2b04f', fog: '#171006' },
  { name: 'Services', color: '#c46a34', fog: '#170b05' },
  { name: 'Data', color: '#8a5ed0', fog: '#100a1b' },
  { name: 'Models', color: '#2f63c2', fog: '#050b1a' },
  { name: 'Ciphertext', color: '#dfe6ee', fog: '#0a0c10' },
]

const H = 3.2 // tunnel half-size
const Z0 = -12 // tunnel mouth
const LEN = 38 // per layer
const Z_END = Z0 - LEN * LAYERS.length
const PORTAL_Z = -232
const TAU = Math.PI * 2

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const seg = (p, a, b) => clamp01((p - a) / (b - a))
const smooth = (t) => t * t * (3 - 2 * t)
const inOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const lerp = (a, b, t) => a + (b - a) * t

// Seeded random so the tunnel is the same on every visit
let seed = 7
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
const rr = (a, b) => a + rnd() * (b - a)

const quadVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`

const bgFrag = /* glsl */ `
uniform float uTime, uSpace, uTunnel, uAspect;
uniform vec3 uFog;
uniform vec2 uOff;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + 1.0), f.x), f.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
void main() {
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) + uOff;
  float n = fbm(p * 1.4 + vec2(uTime * 0.008, 0.0));
  float m = fbm(p * 2.6 + n * 1.7 - uTime * 0.004);
  vec3 col = vec3(0.003, 0.004, 0.007);
  col += vec3(0.55, 0.22, 0.06) * pow(m, 3.2) * 0.32 * smoothstep(0.35, 0.8, n);
  col += vec3(0.1, 0.05, 0.32) * pow(n, 2.6) * 0.42;
  col += vec3(0.02, 0.08, 0.3) * pow(fbm(p * 1.9 - 3.1), 3.0) * 0.45;
  col = mix(col, uFog, uTunnel);
  gl_FragColor = vec4(col * uSpace, uSpace);
}`

const starVert = /* glsl */ `
attribute float aSeed;
uniform float uTime, uPR, uStretch;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = 0.55 + 0.45 * sin(uTime * (0.6 + aSeed * 2.0) + aSeed * 40.0);
  vA = tw * (0.35 + aSeed * 0.65);
  gl_PointSize = (1.2 + aSeed * 2.4) * uPR * (1.0 + uStretch);
}`
const starFrag = /* glsl */ `
uniform float uAlpha;
varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vec3(1.0, 0.97, 0.92) * a * vA * uAlpha * 2.2, a * vA * uAlpha);
}`

const postFrag = /* glsl */ `
uniform sampler2D tScene;
uniform float uAberr, uBlur, uFlash, uFade, uTime, uExposure, uVig;
uniform vec3 uInk, uFlashCol;
uniform vec2 uRes;
varying vec2 vUv;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 d = vUv - 0.5;
  vec4 c = texture2D(tScene, vUv);
  vec3 col = vec3(texture2D(tScene, vUv + d * uAberr).r, c.g, texture2D(tScene, vUv - d * uAberr).b);
  if (uBlur > 0.002) {
    vec3 acc = col;
    for (int i = 1; i < 8; i++) acc += texture2D(tScene, 0.5 + d * (1.0 - uBlur * float(i) / 7.0)).rgb;
    col = acc / 8.0;
  }
  float a = c.a;
  vec3 un = col / max(a, 1e-4);
  un = pow(aces(un * uExposure), vec3(1.0 / 2.2));
  un *= 1.0 - dot(d, d) * 0.6 * uVig;
  un += (hash(vUv * uRes + fract(uTime)) - 0.5) * 0.03;
  un = mix(un, uFlashCol, uFlash);
  a = max(a, uFlash);
  un = mix(un, uInk, uFade);
  a = max(a, uFade);
  gl_FragColor = vec4(un * a, a);
}`

export class Voyage {
  constructor(canvas, { onLayer, isMobile } = {}) {
    this.canvas = canvas
    this.onLayer = onLayer
    this.isMobile = isMobile
    this.progress = 0 // target (from scroll)
    this.p = 0 // damped
    this.enter = 0
    this.vel = 0
    this.layer = -2
    this.mouse = { x: 0, y: 0, sx: 0, sy: 0 }
    this.flip = { t: 0, axis: 'x' }
    this.cols = LAYERS.map((l) => new Color(l.color))
    this.fogs = LAYERS.map((l) => new Color(l.fog))
    this.lc = new Color()
    this.spaceRim = new Color('#2f63c2')
    this.tmp = new Object3D()
    this.visible = false

    const r = (this.renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' }))
    r.setClearColor(0x000000, 0)
    r.shadowMap.enabled = true
    r.shadowMap.type = PCFSoftShadowMap
    this.dpr = Math.min(window.devicePixelRatio, isMobile ? 1.5 : 1.35)
    r.setPixelRatio(this.dpr)

    this.scene = new Scene()
    this.fog = new Fog(0x000000, 10, 58)
    this.scene.fog = this.fog
    this.camera = new PerspectiveCamera(35, 1, 0.1, 140)
    this.scene.add(this.camera)

    this.#env()
    this.#background()
    this.#stars()
    this.#lights()
    this.#astronaut()
    this.#word()
    this.#tunnel()
    this.#post()
    this.resize()

    window.addEventListener('pointermove', (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1
      this.mouse.y = -((e.clientY / window.innerHeight) * 2 - 1)
    }, { passive: true })

    this.start = performance.now()
    this.last = this.start
  }

  /* ---------- Build ---------- */

  // Reflections: a dark room lit by temper-coloured strips (shows up in the visor and steel).
  #env() {
    const env = new Scene()
    env.add(new Mesh(new SphereGeometry(10, 32, 16), new MeshBasicMaterial({ color: 0x07080a, side: BackSide })))
    const strip = (color, w, h, pos, look, k = 1) => {
      const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: new Color(color).multiplyScalar(k), side: DoubleSide }))
      m.position.set(...pos); m.lookAt(...look)
      env.add(m)
    }
    strip('#ffffff', 8, 3, [0, 7, 2], [0, 0, 0], 2.2)
    strip('#e2b04f', 1.2, 8, [-7, 1, 3], [0, 0, 0], 3)
    strip('#2f63c2', 1.2, 8, [7, 0, 2], [0, 0, 0], 3.5)
    strip('#6c44a8', 9, 1, [0, -6, 3], [0, 0, 0], 2.5)
    strip('#c46a34', 6, 2, [0, 2, -8], [0, 0, 0], 2)
    const pm = new PMREMGenerator(this.renderer)
    this.env = pm.fromScene(env, 0.03).texture
    pm.dispose()
  }

  #background() {
    this.bgMat = new ShaderMaterial({
      vertexShader: quadVert, fragmentShader: bgFrag, depthTest: false, depthWrite: false, blending: NoBlending, fog: false,
      uniforms: { uTime: { value: 0 }, uSpace: { value: 0 }, uTunnel: { value: 0 }, uAspect: { value: 1 }, uFog: { value: new Color(0) }, uOff: { value: { x: 0, y: 0 } } },
    })
    const bg = new Mesh(new PlaneGeometry(2, 2), this.bgMat)
    bg.frustumCulled = false
    bg.renderOrder = -10
    this.scene.add(bg)
  }

  #stars() {
    const n = this.isMobile ? 1400 : 2600
    const pos = new Float32Array(n * 3)
    const s = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const u = rr(-1, 1), t = rr(0, TAU), rad = rr(45, 110), q = Math.sqrt(1 - u * u)
      pos[i * 3] = q * Math.cos(t) * rad; pos[i * 3 + 1] = q * Math.sin(t) * rad; pos[i * 3 + 2] = u * rad
      s[i] = Math.pow(rnd(), 2.2)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new BufferAttribute(s, 1))
    this.starMat = new ShaderMaterial({
      vertexShader: starVert, fragmentShader: starFrag, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false,
      uniforms: { uTime: { value: 0 }, uPR: { value: this.dpr }, uAlpha: { value: 1 }, uStretch: { value: 0 } },
    })
    this.stars = new Points(g, this.starMat)
    this.stars.frustumCulled = false
    this.stars.renderOrder = -5
    this.camera.add(this.stars) // stars travel with the camera: an endless sky
  }

  #lights() {
    this.scene.add(new HemisphereLight(0x9fb4d8, 0x1a1210, 0.35))
    // key light follows the astronaut so it can cast soft shadows across the suit
    const key = (this.key = new DirectionalLight(0xfff0dc, 2.6))
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    Object.assign(key.shadow.camera, { left: -2.2, right: 2.2, top: 2.2, bottom: -2.2, near: 0.5, far: 20 })
    key.shadow.bias = -0.0004
    key.shadow.normalBias = 0.02
    key.shadow.radius = 4
    this.scene.add(key, key.target)
    this.rim = new DirectionalLight(0x2f63c2, 5)
    this.rim.position.set(-3, 2.5, -22)
    this.rim.target.position.set(0, 0, -6)
    this.camera.add(this.rim, this.rim.target)
    this.rim2 = new DirectionalLight(0xe2b04f, 2.5)
    this.rim2.position.set(4, -1, -18)
    this.rim2.target.position.set(0, 0, -6)
    this.camera.add(this.rim2, this.rim2.target)
    this.lamp = new PointLight(0xe2b04f, 0, 34, 1)
    this.lamp.position.set(0, 0.4, -3)
    this.camera.add(this.lamp)
  }

  #astronaut() {
    this.astro = createAstronaut({ env: this.env })
    this.astro.root.scale.setScalar(0.92)
    this.scene.add(this.astro.root)
  }

  // DIVE: four letter planes that rise behind the astronaut and split apart as the camera flies through.
  #word() {
    this.letters = []
    this.word = new Group()
    this.word.position.z = -6
    this.scene.add(this.word)
    const build = () => {
      const chars = ['D', 'I', 'V', 'E']
      const fs = 600
      const font = `900 ${fs}px "Big Shoulders Display", "Arial Narrow", sans-serif`
      const ctx0 = document.createElement('canvas').getContext('2d')
      ctx0.font = font
      const widths = chars.map((c) => ctx0.measureText(c).width)
      const gap = fs * 0.06
      const total = widths.reduce((a, b) => a + b, 0) + gap * (chars.length - 1)
      const unit = 14 / total // world units per px
      let x = -total / 2
      chars.forEach((ch, i) => {
        const cw = Math.ceil(widths[i] + 40), chh = Math.ceil(fs * 0.86)
        const cv = document.createElement('canvas')
        cv.width = cw; cv.height = chh
        const ctx = cv.getContext('2d')
        ctx.font = font
        ctx.fillStyle = '#fff'
        ctx.textBaseline = 'alphabetic'
        ctx.fillText(ch, 20, fs * 0.8)
        const tex = new CanvasTexture(cv)
        tex.colorSpace = SRGBColorSpace
        tex.minFilter = LinearFilter
        const mat = new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, color: new Color(1.6, 1.6, 1.6), opacity: 0 })
        const m = new Mesh(new PlaneGeometry(cw * unit, chh * unit), mat)
        const cx = x + widths[i] / 2
        m.userData = { bx: cx * unit, bz: -i * 0.5, i }
        m.position.set(cx * unit, 0, 0)
        this.word.add(m)
        this.letters.push(m)
        x += widths[i] + gap
      })
    }
    document.fonts.load('900 100px "Big Shoulders Display"').then(build, build)
  }

  #tunnel() {
    const t = (this.tunnel = new Group())
    this.scene.add(t)
    const dummy = new Object3D()
    const steel = new MeshStandardMaterial({ color: 0x8b9299, metalness: 0.88, roughness: 0.32, envMap: this.env, envMapIntensity: 1.1 })
    const glowMat = new MeshBasicMaterial({ color: 0xffffff })
    const box = new BoxGeometry(1, 1, 1)
    const cyl = new CylinderGeometry(1, 1, 1, 10, 1)
    const inst = (geo, mat, items, withColor = false) => {
      const m = new InstancedMesh(geo, withColor ? mat.clone() : mat, items.length)
      items.forEach((it, i) => {
        dummy.position.set(...it.p)
        if (it.q) dummy.quaternion.copy(it.q); else dummy.rotation.set(...(it.r || [0, 0, 0]))
        dummy.scale.set(...(it.s || [1, 1, 1]))
        dummy.updateMatrix()
        m.setMatrixAt(i, dummy.matrix)
        if (withColor) m.setColorAt(i, it.c)
      })
      m.frustumCulled = false
      t.add(m)
      return m
    }
    const col = (hex, k) => new Color(hex).multiplyScalar(k)
    // position on a wall: side 0 top, 1 right, 2 bottom, 3 left; u along the wall; inset from the wall
    const wall = (side, u, z, inset = 0) => {
      const h = H - inset
      return [[u, h, z], [h, u, z], [u, -h, z], [-h, u, z]][side]
    }
    const zs = (i) => [Z0 - i * LEN, Z0 - (i + 1) * LEN]

    // Frames + corner rails through the first four layers
    const frames = []
    for (let z = Z0; z > Z0 - LEN * 4; z -= 4.75) {
      frames.push({ p: [0, H, z], s: [H * 2 + 0.1, 0.09, 0.09] }, { p: [0, -H, z], s: [H * 2 + 0.1, 0.09, 0.09] })
      frames.push({ p: [H, 0, z], s: [0.09, H * 2 + 0.1, 0.09] }, { p: [-H, 0, z], s: [0.09, H * 2 + 0.1, 0.09] })
    }
    const railLen = LEN * 4
    ;[[H, H], [H, -H], [-H, H], [-H, -H]].forEach(([x, y]) => frames.push({ p: [x, y, Z0 - railLen / 2], s: [0.07, 0.07, railLen] }))
    inst(box, steel, frames)

    // 01 Interface: glowing panels on the walls
    {
      const [a, b] = zs(0)
      const glow = [], dim = []
      for (let i = 0; i < (this.isMobile ? 70 : 110); i++) {
        const side = (rnd() * 4) | 0, w = rr(0.5, 1.7), h = rr(0.4, 1.4)
        const p = wall(side, rr(-H + 0.9, H - 0.9), rr(b + 1, a - 1), 0.12)
        const s = side % 2 === 0 ? [w, 0.03, h] : [0.03, w, h]
        if (rnd() < 0.62) glow.push({ p, s, c: col('#e2b04f', rr(0.5, 3.2)) })
        else dim.push({ p, s })
        if (rnd() < 0.35) { // a thin "text line" beside the panel
          const q = [...p]; q[2] += h / 2 + 0.2
          glow.push({ p: q, s: side % 2 === 0 ? [w * rr(0.4, 0.9), 0.02, 0.06] : [0.02, w * rr(0.4, 0.9), 0.06], c: col('#f3e2b8', 1.6) })
        }
      }
      inst(box, glowMat, glow, true)
      inst(box, steel, dim)
    }

    // 02 Services: pipes along the walls with packets racing through them
    {
      const [a, b] = zs(1)
      const pipes = []
      this.packets = []
      ;[0, 1, 2, 3].forEach((side) => [-0.62, 0, 0.62].forEach((u) => {
        const rad = rr(0.08, 0.16)
        const p = wall(side, u * H, (a + b) / 2, 0.28)
        pipes.push({ p, r: [Math.PI / 2, 0, 0], s: [rad, LEN, rad] })
        for (let k = 0; k < 8; k++) this.packets.push({ x: p[0], y: p[1], a, speed: rr(5, 14) * (rnd() < 0.5 ? 1 : 0.6), off: rr(0, LEN), c: col(rnd() < 0.7 ? '#c46a34' : '#e2b04f', rr(2, 4)) })
      }))
      inst(cyl, steel, pipes)
      this.packetMesh = inst(box, glowMat, this.packets.map((k) => ({ p: [k.x, k.y, k.a], s: [0.2, 0.2, 0.7], c: k.c })), true)
      this.packetRange = [a + 6, b - 20]
    }

    // 03 Data: walls of stacked blocks, some lit
    {
      const [a, b] = zs(2)
      const lit = [], blocks = []
      const step = 0.62
      for (let side = 0; side < 4; side++) {
        for (let u = -H + step / 2; u < H; u += step) {
          for (let z = a - step / 2; z > b; z -= step) {
            if (rnd() < (this.isMobile ? 0.8 : 0.72)) continue
            const d = rr(0.1, 0.55)
            const p = wall(side, u, z, d / 2)
            const sz = step * 0.9
            const s = side % 2 === 0 ? [sz, d, sz] : [d, sz, sz]
            if (rnd() < 0.16) lit.push({ p, s, c: col(rnd() < 0.8 ? '#8a5ed0' : '#dfe6ee', rr(0.6, 2.4)) })
            else blocks.push({ p, s })
          }
        }
      }
      inst(box, steel, blocks)
      inst(box, glowMat, lit, true)
    }

    // 04 Models: a neural lattice — nodes on the walls wired slice to slice
    {
      const [a] = zs(3)
      const slices = []
      for (let k = 0; k < 8; k++) {
        const z = a - 2.4 - k * 4.75
        const nodes = []
        ;[0, 1, 2, 3].forEach((side) => [-0.55, 0, 0.55].forEach((u) => nodes.push(new Vector3(...wall(side, u * H, z, 0.3)))))
        slices.push(nodes)
      }
      const nodes = slices.flat().map((v) => ({ p: v.toArray(), s: [0.16, 0.16, 0.16], c: col('#5b8ff0', rr(1.6, 3.6)) }))
      inst(new SphereGeometry(1, 16, 12), glowMat, nodes, true)
      const edges = []
      const up = new Vector3(0, 1, 0)
      const link = (A, B, k) => {
        const d = B.clone().sub(A)
        const len = d.length()
        edges.push({ p: A.clone().add(B).multiplyScalar(0.5).toArray(), q: new Quaternion().setFromUnitVectors(up, d.normalize()), s: [0.018, len, 0.018], c: col('#2f63c2', k) })
      }
      slices.forEach((ns, k) => {
        ns.forEach((n, i) => {
          link(n, ns[(i + 1) % ns.length], 0.9) // around the ring
          const next = slices[k + 1]
          if (!next) return
          link(n, next[i], 1.4)
          link(n, next[(i + 1 + ((rnd() * 3) | 0)) % next.length], 1.1)
        })
      })
      inst(cyl, glowMat, edges, true)
    }

    // 05 Ciphertext: counter-rotating rings, like the tumblers of a lock
    {
      const [a] = zs(4)
      this.rings = []
      const segGeo = new BoxGeometry(0.36, 0.14, 0.16)
      for (let k = 0; k < 9; k++) {
        const g = new Group()
        g.position.z = a - 2 - k * 4.2
        const R = 3.3 - (k % 2) * 0.35
        const n = 44
        const lit = [], dark = []
        for (let i = 0; i < n; i++) {
          const ang = (i / n) * TAU
          const it = { p: [Math.cos(ang) * R, Math.sin(ang) * R, 0], r: [0, 0, ang + Math.PI / 2] }
          if ((i * 7 + k * 3) % 5 < 2) lit.push({ ...it, c: col(rnd() < 0.7 ? '#f3e6cf' : '#e2b04f', rr(1.4, 3.4)) })
          else if (rnd() < 0.85) dark.push(it)
        }
        const m1 = inst(segGeo, glowMat, lit, true)
        const m2 = inst(segGeo, steel, dark)
        t.remove(m1, m2)
        g.add(m1, m2)
        const band = new Mesh(new TorusGeometry(R - 0.22, 0.025, 6, 64), steel)
        g.add(band)
        g.userData.speed = (k % 2 ? -1 : 1) * rr(0.25, 0.6)
        t.add(g)
        this.rings.push(g)
      }
    }

    // Exit portal
    const portal = new Group()
    portal.position.z = PORTAL_Z
    const disc = new Mesh(new CircleGeometry(4.2, 64), new MeshBasicMaterial({ color: new Color('#f3e6cf').multiplyScalar(5), fog: false }))
    const halo = new Mesh(new TorusGeometry(4.5, 0.1, 10, 96), new MeshBasicMaterial({ color: new Color('#e2b04f').multiplyScalar(4), fog: false }))
    portal.add(disc, halo)
    this.portal = portal
    t.add(portal)
  }

  #post() {
    const w = 4, h = 4
    this.rt = new WebGLRenderTarget(w, h, { type: HalfFloatType, samples: this.isMobile ? 0 : 4 })
    this.postMat = new ShaderMaterial({
      vertexShader: quadVert, fragmentShader: postFrag, blending: NoBlending, depthTest: false, depthWrite: false,
      uniforms: {
        tScene: { value: this.rt.texture }, uAberr: { value: 0 }, uBlur: { value: 0 }, uFlash: { value: 0 }, uFade: { value: 0 },
        // the post pass works in display (sRGB) values, so these are set raw
        uTime: { value: 0 }, uExposure: { value: 1.05 }, uVig: { value: 1 }, uInk: { value: new Color().setRGB(14 / 255, 17 / 255, 20 / 255) },
        uFlashCol: { value: new Color().setRGB(0.95, 0.9, 0.81) }, uRes: { value: { x: 1, y: 1 } },
      },
    })
    this.postScene = new Scene()
    this.postCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const q = new Mesh(new PlaneGeometry(2, 2), this.postMat)
    q.frustumCulled = false
    this.postScene.add(q)
  }

  /* ---------- Runtime ---------- */

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth
    const h = this.canvas.clientHeight || window.innerHeight
    this.w = w; this.h = h
    this.renderer.setSize(w, h, false)
    const aspect = w / h
    this.camera.aspect = aspect
    this.camera.fov = aspect < 1 ? 52 : 35
    this.camera.updateProjectionMatrix()
    this.camDist = aspect < 1 ? 10 : 7.6
    this.rt.setSize(Math.floor(w * this.dpr), Math.floor(h * this.dpr))
    this.bgMat.uniforms.uAspect.value = aspect
    this.postMat.uniforms.uRes.value = { x: w * this.dpr, y: h * this.dpr }
    // keep DIVE inside the frame on narrow screens
    const vis = 2 * (this.camDist - 0.9 + 6) * Math.tan((this.camera.fov * Math.PI) / 360) * aspect
    this.word.scale.setScalar(Math.min(1, (vis * 0.8) / 14))
  }

  doFlip() {
    if (this.flipTween?.isActive()) return
    const tunnel = this.p > 0.3
    this.flip.axis = tunnel ? 'z' : 'x'
    this.flip.t = 0
    this.flipTween = gsap.to(this.flip, { t: 1, duration: tunnel ? 1 : 1.25, ease: 'power2.inOut' })
  }

  // Where the camera is along the dive, as a function of progress.
  #camZ(p) {
    const D = this.camDist
    if (p < 0.16) return D - 0.9 * smooth(p / 0.16)
    if (p < 0.3) { const u = seg(p, 0.2, 0.3); return lerp(D - 0.9, -8, u * u) } // hold until he's airborne
    if (p < 0.84) return lerp(-8, Z_END + 2, seg(p, 0.3, 0.84))
    const u = seg(p, 0.84, 1)
    return lerp(Z_END + 2, PORTAL_Z + 1.6, 1 - (1 - u) * (1 - u)) // into the light
  }

  #adapt(dt) {
    if (dt > 250) return
    this.frames = (this.frames || 0) + 1
    this.acc = (this.acc || 0) + dt
    if (this.frames < 60) return
    const avg = this.acc / this.frames
    this.frames = 0; this.acc = 0
    if (avg < 22 || this.dpr <= 0.75) return
    this.dpr = Math.max(0.75, this.dpr - 0.25)
    this.renderer.setPixelRatio(this.dpr)
    this.starMat.uniforms.uPR.value = this.dpr
    this.resize()
  }

  render() {
    const now = performance.now()
    const dt = Math.min(now - this.last, 100)
    this.last = now
    if (!this.visible) return
    this.#adapt(dt)
    const t = (now - this.start) / 1000
    const k = 1 - Math.pow(0.001, dt / 1000) // frame-rate independent damping
    const prevP = this.p
    this.p += (this.progress - this.p) * Math.min(1, k * 2.2)
    const p = this.p
    const speed = (p - prevP) / Math.max(dt, 1) * 1000 // progress per second
    const m = this.mouse
    m.sx += (m.x - m.sx) * Math.min(1, k * 1.6)
    m.sy += (m.y - m.sy) * Math.min(1, k * 1.6)

    const enter = this.enter
    const space = p < 0.3
    const tunnelAmt = smooth(seg(p, 0.26, 0.34))
    const exit = seg(p, 0.84, 1)

    // Camera
    const cam = this.camera
    const cz = this.#camZ(p)
    const sway = tunnelAmt
    cam.position.set(
      m.sx * 0.35 + Math.sin(cz * 0.06) * 0.5 * sway,
      0.25 + m.sy * 0.22 + Math.cos(cz * 0.045) * 0.35 * sway,
      cz,
    )
    cam.rotation.set(m.sy * 0.04, -m.sx * 0.06, (Math.sin(cz * 0.02) * 0.18 + speed * 0.25) * sway)
    const fovBase = this.camera.aspect < 1 ? 52 : 35
    const fov = fovBase + Math.min(Math.abs(speed) * 14, 8) * sway
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * 0.15; cam.updateProjectionMatrix() }

    // Layer + colours
    let li = -1
    if (p > 0.29 && p < 0.86) li = Math.min(4, Math.max(0, Math.floor((Z0 - cz) / LEN)))
    if (li !== this.layer) { this.layer = li; this.onLayer?.(li) }
    const fl = Math.min(4, Math.max(0, (Z0 - cz) / LEN - 0.5))
    const ci = Math.floor(fl), cf = smooth(fl - ci)
    const lc = this.lc.copy(this.cols[ci]).lerp(this.cols[Math.min(4, ci + 1)], cf)
    this.fog.color.copy(this.fogs[ci]).lerp(this.fogs[Math.min(4, ci + 1)], cf).multiplyScalar(tunnelAmt)
    this.fog.near = lerp(10, 5, tunnelAmt)
    this.fog.far = lerp(70, 38, tunnelAmt)
    this.bgMat.uniforms.uFog.value.copy(this.fog.color)
    this.bgMat.uniforms.uTunnel.value = tunnelAmt
    this.bgMat.uniforms.uSpace.value = smooth(seg(enter, 0.45, 1)) // after the page has turned dark
    this.bgMat.uniforms.uTime.value = t
    this.bgMat.uniforms.uOff.value = { x: m.sx * 0.03, y: m.sy * 0.03 + p * 0.4 }
    this.lamp.color.copy(lc)
    this.lamp.intensity = 7 * tunnelAmt
    this.rim.color.copy(space ? this.spaceRim : lc)
    this.starMat.uniforms.uTime.value = t
    this.starMat.uniforms.uAlpha.value = smooth(seg(enter, 0.45, 1)) * lerp(1, 0.35, tunnelAmt)
    this.starMat.uniforms.uStretch.value = Math.min(Math.abs(speed) * 2, 1.5) * tunnelAmt
    this.stars.rotation.set(m.sy * 0.05, m.sx * 0.08, t * 0.004)

    // Astronaut
    const A = this.astro
    const root = A.root
    const bob = Math.sin(t * 0.9) * 0.08
    const launch = seg(p, 0.16, 0.3)
    const crouchW = smooth(seg(launch, 0, 0.32)) * (1 - smooth(seg(launch, 0.32, 0.42)))
    const air = seg(launch, 0.36, 1)
    let mix
    let pos = new Vector3(0, bob - (1 - enter) * 2.2, 0)
    let rx = 0, ry = m.sx * 0.35 + Math.sin(t * 0.3) * 0.12, rz = Math.sin(t * 0.5) * 0.06
    if (p < 0.3 && air === 0) {
      mix = [[POSES.idle, 1 - crouchW], [POSES.crouch, crouchW]]
      ry *= 1 - crouchW
    } else if (p < 0.3) {
      // spring away through the letters with a backflip
      const stretch = 1 - smooth(seg(air, 0.1, 0.4))
      const tuck = smooth(seg(air, 0.2, 0.45)) * (1 - smooth(seg(air, 0.6, 0.9)))
      const fall = smooth(seg(air, 0.6, 1))
      mix = [[POSES.stretch, stretch], [POSES.tuck, tuck], [POSES.freefall, fall]]
      const targetZ = this.#camZ(0.3) - 9
      pos.z = lerp(0, targetZ, inOut(air))
      pos.y += Math.sin(Math.PI * air) * 1.6 + lerp(0, 0.25, air)
      rx = -TAU * inOut(seg(air, 0.05, 0.85))
      ry = 0
    } else {
      // tunnel: fly ahead of the camera, drift toward the cursor, roll with speed
      const wave = smooth(seg(exit, 0.1, 0.35))
      mix = [[POSES.freefall, 1 - wave], [POSES.wave, wave]]
      const ahead = 9 + smooth(seg(exit, 0.5, 0.9)) * 16
      pos.set(cam.position.x * 0.6 + m.sx * 1.1, 0.05 + m.sy * 0.7 + bob, cz - ahead)
      rx = 0.25 + m.sy * 0.2 - speed * 0.3
      ry = m.sx * 0.4
      rz = -m.sx * 0.25 + Math.sin(t * 0.7) * 0.08 - speed * 0.6
    }
    // click-to-flip on top of everything
    const f = this.flip.t
    const fk = Math.sin(Math.PI * f)
    if (f > 0 && f < 1) {
      mix.push([POSES.tuck, fk * 1.4])
      if (this.flip.axis === 'x') { rx -= TAU * inOut(f); pos.y += fk * 0.7 }
      else rz += TAU * inOut(f)
    }
    const waving = p > 0.84 ? smooth(seg(exit, 0.1, 0.35)) : 0
    A.apply(mix, (P) => {
      P.neck[1] += m.sx * 0.55 * (1 - fk); P.neck[0] -= m.sy * 0.3 * (1 - fk)
      P.spine[1] += m.sx * 0.15
      // idle drift in the limbs
      P.shL[2] += Math.sin(t * 1.1) * 0.08; P.shR[2] -= Math.sin(t * 1.1 + 0.8) * 0.08
      P.hipL[0] += Math.sin(t * 1.3) * 0.1; P.hipR[0] -= Math.sin(t * 1.3) * 0.1
      if (p >= 0.3) { P.knL[0] += Math.max(0, Math.sin(t * 2.2)) * 0.25; P.knR[0] += Math.max(0, -Math.sin(t * 2.2)) * 0.25 }
      if (waving) { P.elR[2] += Math.sin(t * 8) * 0.38 * waving; P.shR[2] += Math.sin(t * 8 + 0.6) * 0.06 * waving }
    })
    root.position.copy(pos)
    root.rotation.set(rx, ry, rz, 'YXZ')
    this.key.target.position.copy(pos)
    this.key.position.set(pos.x + 4, pos.y + 5, pos.z + 5)

    // DIVE letters
    const rise = smooth(seg(p, 0.07, 0.15))
    for (const L of this.letters) {
      const { bx, bz, i } = L.userData
      const wz = this.word.position.z + bz
      const dist = cz - wz
      const split = smooth(clamp01((9 - dist) / 8))
      const ri = smooth(clamp01(rise * 1.6 - i * 0.2))
      L.position.set(bx * (1 + split * 1.6), lerp(-2.4, 0.35, ri) + split * (i % 2 ? 1 : -1) * 1.2, bz)
      L.rotation.set(0, -Math.sign(bx) * split * 0.6, (i % 2 ? 1 : -1) * split * 0.15)
      L.material.opacity = ri * clamp01((dist - 0.6) / 2.4) * (dist > 0 ? 1 : 0)
    }

    // Tunnel motion (only the part near the camera)
    if (this.packets && cz < this.packetRange[0] && cz > this.packetRange[1]) {
      const d = this.tmp
      this.packets.forEach((pk, i) => {
        const z = pk.a - ((pk.off + t * pk.speed) % LEN)
        d.position.set(pk.x, pk.y, z)
        d.scale.set(0.2, 0.2, 0.7)
        d.updateMatrix()
        this.packetMesh.setMatrixAt(i, d.matrix)
      })
      this.packetMesh.instanceMatrix.needsUpdate = true
    }
    if (cz < Z0 - LEN * 3.6) this.rings.forEach((g) => { g.rotation.z += g.userData.speed * (dt / 1000) * (1 + Math.abs(speed) * 6) })
    this.tunnel.visible = enter > 0.02

    // Post
    const pass = this.letters.length ? Math.exp(-Math.pow(cz - this.word.position.z, 2) * 0.35) : 0
    const u = this.postMat.uniforms
    u.uTime.value = t
    u.uAberr.value = 0.004 + Math.min(Math.abs(speed) * 0.05, 0.03) * tunnelAmt + pass * 0.035 + fk * 0.01
    u.uBlur.value = Math.min(Math.abs(speed) * 0.35, 0.16) * tunnelAmt + pass * 0.08
    u.uFlash.value = 0
    u.uVig.value = 1 - smooth(seg(exit, 0.4, 0.7))
    u.uFade.value = smooth(seg(exit, 0.74, 0.86))
    u.uExposure.value = 1.05 + smooth(seg(exit, 0.35, 0.7)) * 0.6

    const r = this.renderer
    r.setRenderTarget(this.rt)
    r.clear()
    r.render(this.scene, cam)
    r.setRenderTarget(null)
    r.render(this.postScene, this.postCam)
  }
}
