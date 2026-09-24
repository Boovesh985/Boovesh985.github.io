import { BufferAttribute, BufferGeometry, Group, HalfFloatType, LinearFilter, LinearSRGBColorSpace, Mesh, NoBlending, OrthographicCamera, PerspectiveCamera, PlaneGeometry, Points, Scene, ShaderMaterial, Sphere, Vector2, Vector3, WebGLRenderTarget, WebGLRenderer } from 'three'
import gsap from 'gsap'
import { sphere, pipes, network, heart, spiral } from './shapes.js'
import { particlesVert, particlesFrag, quadVert, trailFrag, postFrag } from './shaders.js'

const hex = (h) => {
  const n = parseInt(h.slice(1), 16)
  return new Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

export class GL {
  constructor(canvas, { shape = 0, reduced = false, page = 'home' } = {}) {
    this.canvas = canvas
    this.page = page
    this.reduced = reduced
    this.isMobile = window.matchMedia('(max-width: 900px)').matches
    this.renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' })
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.outputColorSpace = LinearSRGBColorSpace
    this.dpr = Math.min(window.devicePixelRatio, 1.75)
    this.renderer.setPixelRatio(this.dpr)

    this.scene = new Scene()
    this.camera = new PerspectiveCamera(35, 1, 0.1, 100)
    this.camera.position.set(0, 0, 7.2)

    this.group = new Group()
    this.scene.add(this.group)
    this.target = { x: 0, y: 0, scale: 1 }
    this.pointer = { x: 0, y: 0, nx: 0.5, ny: 0.5, px: 0.5, py: 0.5, vx: 0, vy: 0, active: 0, moved: false }
    this.mouseWorld = new Vector3(99, 99, 0)
    this.scrollVel = 0
    this.shape = shape

    this.#buildParticles()
    this.#buildTrail()
    this.#buildPost()
    this.resize()
    this.setShape(shape, true)

    window.addEventListener('resize', () => this.resize())
    window.addEventListener('pointermove', (e) => this.#onPointer(e), { passive: true })
    window.addEventListener('pointerdown', (e) => {
      this.#onPointer(e)
      if (e.pointerType === 'mouse' && e.button === 0 && !e.target.closest('a, button')) this.setAttract(true)
    }, { passive: true })
    window.addEventListener('pointerup', () => this.setAttract(false))
    window.addEventListener('blur', () => this.setAttract(false))
    document.addEventListener('pointerleave', () => { this.pointer.active = 0 })

    this.start = performance.now()
    this.last = this.start
    gsap.ticker.add(() => this.render())
  }

  #buildParticles() {
    const n = this.isMobile ? 12000 : 24000
    this.count = n
    const g = new BufferGeometry()
    const shapes = [sphere(n), pipes(n), network(n), heart(n), spiral(n)]
    g.setAttribute('position', new BufferAttribute(shapes[0], 3))
    shapes.forEach((s, i) => g.setAttribute('aP' + i, new BufferAttribute(s, 3)))
    const rand = new Float32Array(n * 4)
    for (let i = 0; i < n * 4; i++) rand[i] = Math.random()
    g.setAttribute('aRand', new BufferAttribute(rand, 4))
    g.boundingSphere = new Sphere(new Vector3(), 10)

    this.weights = [1, 0, 0, 0, 0]
    this.pMat = new ShaderMaterial({
      vertexShader: particlesVert,
      fragmentShader: particlesFrag,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: this.isMobile ? 18 : 20 },
        uPixelRatio: { value: this.dpr },
        uIntro: { value: this.reduced ? 1 : 0 },
        uTurb: { value: 0 },
        uTheme: { value: 0 },
        uOpacity: { value: 1 },
        uMouseStrength: { value: 0 },
        uBurst: { value: 0 },
        uAttract: { value: 0 },
        uW: { value: this.weights },
        uMouse: { value: this.mouseWorld },
        uInk: { value: hex('#0e1114') },
        uSteel: { value: hex('#c9cdd1') },
        uT0: { value: hex('#e2b04f') },
        uT1: { value: hex('#c46a34') },
        uT2: { value: hex('#6c44a8') },
        uT3: { value: hex('#2f63c2') },
      },
    })
    this.points = new Points(g, this.pMat)
    this.group.add(this.points)
  }

  #buildTrail() {
    const opts = { type: HalfFloatType, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false }
    this.trailA = new WebGLRenderTarget(192, 192, opts)
    this.trailB = new WebGLRenderTarget(192, 192, opts)
    this.trailMat = new ShaderMaterial({
      vertexShader: quadVert,
      fragmentShader: trailFrag,
      uniforms: {
        tPrev: { value: null },
        uMouse: { value: new Vector2(0.5, 0.5) },
        uVel: { value: new Vector2() },
        uAspect: { value: 1 },
        uRadius: { value: 0.0022 },
        uDecay: { value: 0.955 },
        uActive: { value: 0 },
      },
    })
    this.quadScene = new Scene()
    this.quadCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.quad = new Mesh(new PlaneGeometry(2, 2), this.trailMat)
    this.quad.frustumCulled = false
    this.quadScene.add(this.quad)
  }

  #buildPost() {
    this.sceneRT = new WebGLRenderTarget(4, 4, { depthBuffer: false })
    this.postMat = new ShaderMaterial({
      vertexShader: quadVert,
      fragmentShader: postFrag,
      blending: NoBlending,
      uniforms: { tScene: { value: this.sceneRT.texture }, tTrail: { value: null }, uStrength: { value: this.reduced ? 0 : 1 } },
    })
  }

  #onPointer(e) {
    const p = this.pointer
    p.nx = e.clientX / window.innerWidth
    p.ny = 1 - e.clientY / window.innerHeight
    p.active = 1
    p.moved = true
  }

  // Programmatic pointer (for the hero's auto-sweep on load and on touch devices)
  feedPointer(x, y) {
    this.pointer.nx = x / window.innerWidth
    this.pointer.ny = 1 - y / window.innerHeight
    this.pointer.active = 1
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight
    this.isMobile = window.matchMedia('(max-width: 900px)').matches
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.sceneRT.setSize(Math.floor(w * this.dpr), Math.floor(h * this.dpr))
    this.trailMat.uniforms.uAspect.value = w / h
    // Keep shapes a sensible size on portrait screens
    this.baseScale = Math.min(1, (w / h) * 0.95 + 0.25)
    // Re-target the layout for the new size without resetting a morph in progress
    const L = this.#layout(this.shape)
    this.target.x = L.x; this.target.y = L.y; this.target.scale = L.s * this.baseScale
  }

  // Where each shape sits on screen (desktop / mobile)
  #layout(i) {
    const m = this.isMobile
    const L = [
      { x: m ? 0 : 0.35, y: m ? 0.15 : 0.28, s: m ? 0.7 : 0.82 },
      { x: m ? 0 : 1.55, y: m ? 1.0 : 0, s: m ? 0.62 : 0.8 },
      { x: m ? 0 : 1.35, y: m ? 1.0 : 0, s: m ? 0.55 : 0.75 },
      { x: m ? 0 : 1.6, y: m ? 0.95 : 0, s: m ? 0.62 : 0.85 },
      { x: m ? 0 : 1.2, y: 0, s: m ? 0.7 : 0.9 },
    ]
    // Case-study pages have a wider title column, so shapes sit further right and smaller.
    if (this.page === 'project' && !m && i > 0) return { ...L[i], x: L[i].x + 0.35, s: L[i].s * 0.78 }
    return L[i]
  }

  setShape(i, instant = false, layout = null) {
    this.shape = i
    const w = {}
    this.weights.forEach((_, j) => (w[j] = j === i ? 1 : 0))
    const L = layout || this.#layout(i)
    this.target.x = L.x; this.target.y = L.y; this.target.scale = L.s * this.baseScale
    if (instant) {
      this.weights.forEach((_, j) => (this.weights[j] = w[j]))
      this.group.position.set(L.x, L.y, 0)
      this.group.scale.setScalar(this.target.scale)
      return
    }
    gsap.to(this.weights, { ...w, duration: this.reduced ? 0.01 : 1.9, ease: 'power3.inOut', overwrite: true })
  }

  setTheme(dark) {
    gsap.to(this.pMat.uniforms.uTheme, { value: dark ? 1 : 0, duration: 0.9, ease: 'power2.out' })
  }

  // Particles fling outward and settle back (hovering projects, page transitions)
  burst(amount = 0.45) {
    if (this.reduced) return
    const u = this.pMat.uniforms.uBurst
    gsap.timeline({ overwrite: true })
      .to(u, { value: amount, duration: 0.35, ease: 'power2.out' })
      .to(u, { value: 0, duration: 1.6, ease: 'power3.inOut' })
  }

  setAttract(on) {
    if (this.reduced) return
    gsap.to(this.pMat.uniforms.uAttract, { value: on ? 1 : 0, duration: on ? 0.9 : 1.4, ease: on ? 'power2.out' : 'elastic.out(1, 0.6)', overwrite: true })
  }

  // Lower resolution, then particle count, if frames run long; never raise it back mid-session.
  #adapt(dt) {
    if (document.hidden || dt > 250) return
    this.frames = (this.frames || 0) + 1
    this.acc = (this.acc || 0) + dt
    if (this.frames < 90) return
    const avg = this.acc / this.frames
    this.frames = 0; this.acc = 0
    if (performance.now() - this.start < 4000 || avg < 21) return
    if (this.dpr > 1) {
      this.dpr = Math.max(1, this.dpr - 0.35)
      this.renderer.setPixelRatio(this.dpr)
      this.pMat.uniforms.uPixelRatio.value = this.dpr
      this.resize()
    } else if (!this.reducedCount) {
      this.reducedCount = true
      this.points.geometry.setDrawRange(0, Math.floor(this.count * 0.6))
      this.pMat.uniforms.uSize.value *= 1.15
    }
  }

  setOpacity(v, d = 0.8) {
    gsap.to(this.pMat.uniforms.uOpacity, { value: v, duration: d, ease: 'power2.out' })
  }

  intro(d = 2.6) {
    gsap.to(this.pMat.uniforms.uIntro, { value: 1, duration: this.reduced ? 0.01 : d, ease: 'power2.out' })
  }

  render() {
    const now = performance.now()
    this.#adapt(now - this.last)
    this.last = now
    const t = (now - this.start) / 1000
    const u = this.pMat.uniforms
    u.uTime.value = this.reduced ? 0 : t
    this.scrollVel += (0 - this.scrollVel) * 0.08
    u.uTurb.value += (Math.min(Math.abs(this.scrollVel) * 0.02, 1.2) - u.uTurb.value) * 0.1

    // pointer smoothing + velocity
    const p = this.pointer
    p.vx = p.nx - p.px; p.vy = p.ny - p.py
    p.px += (p.nx - p.px) * 0.5; p.py += (p.ny - p.py) * 0.5
    const speed = Math.hypot(p.vx, p.vy)
    u.uMouseStrength.value += ((p.active ? Math.min(0.35 + speed * 30, 1) : 0) - u.uMouseStrength.value) * 0.06

    // mouse on the z=0 plane in world space
    const v = new Vector3(p.px * 2 - 1, p.py * 2 - 1, 0.5).unproject(this.camera)
    v.sub(this.camera.position).normalize()
    const dist = -this.camera.position.z / v.z
    this.mouseWorld.copy(this.camera.position).add(v.multiplyScalar(dist))

    // group motion
    const g = this.group
    g.position.x += (this.target.x - g.position.x) * 0.045
    g.position.y += (this.target.y - g.position.y) * 0.045
    const s = g.scale.x + (this.target.scale - g.scale.x) * 0.045
    g.scale.setScalar(s)
    const rx = (p.py - 0.5) * 0.35, ry = (p.px - 0.5) * 0.5
    // Round shapes spin; flat ones (pipes, agent graph, heart) sway so they never turn edge-on.
    const round = this.shape === 0 || this.shape === 4
    let ty = (this.reduced ? 0 : round ? t * 0.07 : Math.sin(t * 0.25) * 0.32) + ry
    ty += Math.PI * 2 * Math.round((g.rotation.y - ty) / (Math.PI * 2))
    g.rotation.y += (ty - g.rotation.y) * 0.05
    g.rotation.x += (-rx - g.rotation.x) * 0.05

    // trail ping-pong
    const tm = this.trailMat.uniforms
    tm.tPrev.value = this.trailA.texture
    tm.uMouse.value.set(p.px, p.py)
    tm.uVel.value.set(p.vx * 14, p.vy * 14)
    tm.uActive.value = p.active
    this.quad.material = this.trailMat
    this.renderer.setRenderTarget(this.trailB)
    this.renderer.render(this.quadScene, this.quadCam)
    ;[this.trailA, this.trailB] = [this.trailB, this.trailA]

    // particles → RT
    this.renderer.setRenderTarget(this.sceneRT)
    this.renderer.clear()
    this.renderer.render(this.scene, this.camera)

    // composite
    this.postMat.uniforms.tTrail.value = this.trailA.texture
    this.quad.material = this.postMat
    this.renderer.setRenderTarget(null)
    this.renderer.render(this.quadScene, this.quadCam)
  }
}
