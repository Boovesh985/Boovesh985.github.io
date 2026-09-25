import { CanvasTexture, ClampToEdgeWrapping, RepeatWrapping, SRGBColorSpace } from 'three'

// Procedural textures for the spacesuit, drawn once and shared by every renderer.

const canvas = (n) => {
  const c = document.createElement('canvas')
  c.width = c.height = n
  return c
}

// Seeded noise so the suit looks the same on every visit
let seed = 11
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646

function tex(c, { srgb = false, repeat = 1 } = {}) {
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(repeat, repeat)
  t.anisotropy = 8
  if (srgb) t.colorSpace = SRGBColorSpace
  return t
}

// Height map (grey canvas) → tangent-space normal map
function toNormal(h, strength) {
  const n = h.width
  const src = h.getContext('2d').getImageData(0, 0, n, n).data
  const out = canvas(n)
  const ctx = out.getContext('2d')
  const img = ctx.createImageData(n, n)
  const d = img.data
  const at = (x, y) => src[(((y + n) % n) * n + ((x + n) % n)) * 4] / 255
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength
      const l = Math.hypot(dx, dy, 1)
      const i = (y * n + x) * 4
      d[i] = (-dx / l * 0.5 + 0.5) * 255
      d[i + 1] = (dy / l * 0.5 + 0.5) * 255
      d[i + 2] = (1 / l * 0.5 + 0.5) * 255
      d[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return out
}

function blurred(c, px) {
  const o = canvas(c.width)
  const x = o.getContext('2d')
  x.filter = `blur(${px}px)`
  // draw tiled so the blur wraps at the edges
  for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) x.drawImage(c, dx * c.width, dy * c.width)
  return o
}

// Woven outer layer with quilted seams and stitching
function fabric() {
  const N = 512
  const h = canvas(N)
  const x = h.getContext('2d')
  x.fillStyle = '#808080'; x.fillRect(0, 0, N, N)
  // basket weave
  for (let py = 0; py < N; py += 4) {
    for (let px = 0; px < N; px += 4) {
      const across = ((px >> 2) + (py >> 2)) % 2
      const g = x.createLinearGradient(px, py, across ? px + 4 : px, across ? py : py + 4)
      g.addColorStop(0, '#6c6c6c'); g.addColorStop(0.5, '#a2a2a2'); g.addColorStop(1, '#6c6c6c')
      x.fillStyle = g
      x.fillRect(px + 0.3, py + 0.3, 3.4, 3.4)
    }
  }
  // quilting seams + stitches
  const seams = (draw) => {
    for (let y = 64; y < N; y += 128) draw(0, y, N, y)
    for (let xx = 128; xx < N; xx += 256) draw(xx, 0, xx, N)
  }
  x.lineCap = 'round'
  seams((a, b, c, d) => { x.strokeStyle = '#2a2a2a'; x.lineWidth = 5; x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); x.stroke() })
  seams((a, b, c, d) => {
    x.strokeStyle = '#c8c8c8'; x.lineWidth = 1.6; x.setLineDash([5, 4])
    const o = 7, hor = b === d
    for (const s of [-1, 1]) { x.beginPath(); x.moveTo(a + (hor ? 0 : s * o), b + (hor ? s * o : 0)); x.lineTo(c + (hor ? 0 : s * o), d + (hor ? s * o : 0)); x.stroke() }
    x.setLineDash([])
  })
  // soft puffiness between seams
  const puff = canvas(N)
  const p = puff.getContext('2d')
  for (let y = 0; y < N; y += 128) {
    const g = p.createLinearGradient(0, y - 64, 0, y + 64)
    g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(0.5, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0.35)')
    p.fillStyle = g; p.fillRect(0, y, N, 128)
  }
  x.globalCompositeOperation = 'overlay'
  x.drawImage(blurred(puff, 6), 0, 0)
  x.globalCompositeOperation = 'source-over'
  const normal = toNormal(blurred(h, 0.6), 2.2)

  // albedo: off-white with slight wear and darker seams
  const a = canvas(N)
  const ax = a.getContext('2d')
  ax.fillStyle = '#ecebe6'; ax.fillRect(0, 0, N, N)
  for (let i = 0; i < 26; i++) {
    const cx = rnd() * N, cy = rnd() * N, r = 20 + rnd() * 90
    const g = ax.createRadialGradient(cx, cy, 0, cx, cy, r)
    g.addColorStop(0, `rgba(120,110,95,${0.05 + rnd() * 0.07})`); g.addColorStop(1, 'rgba(120,110,95,0)')
    ax.fillStyle = g; ax.fillRect(cx - r, cy - r, r * 2, r * 2)
  }
  ax.globalAlpha = 0.18
  ax.drawImage(h, 0, 0)
  ax.globalAlpha = 1
  seams((a1, b, c, d) => { ax.strokeStyle = 'rgba(80,76,70,0.35)'; ax.lineWidth = 4; ax.beginPath(); ax.moveTo(a1, b); ax.lineTo(c, d); ax.stroke() })

  // roughness: matte cloth, slightly shinier where it's worn
  const r = canvas(N)
  const rx = r.getContext('2d')
  rx.fillStyle = '#c4c4c4'; rx.fillRect(0, 0, N, N)
  for (let i = 0; i < 1800; i++) {
    const v = 150 + rnd() * 90
    rx.fillStyle = `rgba(${v},${v},${v},0.25)`
    rx.fillRect(rnd() * N, rnd() * N, 2 + rnd() * 6, 2 + rnd() * 6)
  }
  return { map: tex(a, { srgb: true, repeat: 2 }), normalMap: tex(normal, { repeat: 2 }), roughnessMap: tex(blurred(r, 1), { repeat: 2 }) }
}

// Hard shell (helmet, backpack): panel lines, rivets and fine scuffs
function shell() {
  const N = 512
  const h = canvas(N)
  const x = h.getContext('2d')
  x.fillStyle = '#808080'; x.fillRect(0, 0, N, N)
  x.strokeStyle = '#3a3a3a'; x.lineWidth = 3
  ;[[40, 60, 432, 180], [40, 270, 200, 190], [272, 270, 200, 190]].forEach(([a, b, w, hh]) => {
    x.beginPath(); x.roundRect(a, b, w, hh, 14); x.stroke()
    for (const [rx, ry] of [[a + 12, b + 12], [a + w - 12, b + 12], [a + 12, b + hh - 12], [a + w - 12, b + hh - 12]]) {
      const g = x.createRadialGradient(rx - 1, ry - 1, 0, rx, ry, 5)
      g.addColorStop(0, '#e0e0e0'); g.addColorStop(1, '#808080')
      x.fillStyle = g; x.beginPath(); x.arc(rx, ry, 5, 0, Math.PI * 2); x.fill()
    }
  })
  const r = canvas(N)
  const rx = r.getContext('2d')
  rx.fillStyle = '#5a5a5a'; rx.fillRect(0, 0, N, N)
  rx.strokeStyle = 'rgba(200,200,200,0.35)'; rx.lineWidth = 1
  for (let i = 0; i < 160; i++) {
    const a = rnd() * N, b = rnd() * N, l = 6 + rnd() * 30, t = rnd() * Math.PI
    rx.beginPath(); rx.moveTo(a, b); rx.lineTo(a + Math.cos(t) * l, b + Math.sin(t) * l); rx.stroke()
  }
  return { normalMap: tex(toNormal(blurred(h, 0.8), 3)), roughnessMap: tex(blurred(r, 0.5)) }
}

// Boot soles and glove grips: rubber tread
function tread() {
  const N = 256
  const h = canvas(N)
  const x = h.getContext('2d')
  x.fillStyle = '#a0a0a0'; x.fillRect(0, 0, N, N)
  x.fillStyle = '#303030'
  for (let y = 0; y < N; y += 32) for (let xx = 0; xx < N; xx += 32) {
    x.save(); x.translate(xx + 16, y + 16); x.rotate(((xx + y) / 32) % 2 ? 0.6 : -0.6); x.fillRect(-12, -3, 24, 6); x.restore()
  }
  return { normalMap: tex(toNormal(blurred(h, 1), 3), { repeat: 2 }) }
}

// Mission patch: "BT" inside a temper-coloured ring
function patch() {
  const N = 256
  const c = canvas(N)
  const x = c.getContext('2d')
  const g = x.createLinearGradient(0, 0, N, N)
  ;['#e2b04f', '#c46a34', '#6c44a8', '#2f63c2'].forEach((col, i) => g.addColorStop(i / 3, col))
  x.fillStyle = g; x.beginPath(); x.arc(N / 2, N / 2, N / 2 - 4, 0, Math.PI * 2); x.fill()
  x.fillStyle = '#0e1114'; x.beginPath(); x.arc(N / 2, N / 2, N / 2 - 26, 0, Math.PI * 2); x.fill()
  x.strokeStyle = '#e9e6df'; x.lineWidth = 3; x.setLineDash([6, 5])
  x.beginPath(); x.arc(N / 2, N / 2, N / 2 - 14, 0, Math.PI * 2); x.stroke()
  x.setLineDash([])
  x.fillStyle = '#e9e6df'; x.font = '900 118px "Big Shoulders Display", "Arial Narrow", sans-serif'
  x.textAlign = 'center'; x.textBaseline = 'middle'
  x.fillText('BT', N / 2, N / 2 + 8)
  // three small stars
  x.fillStyle = '#e2b04f'
  ;[-40, 0, 40].forEach((dx) => { x.beginPath(); x.arc(N / 2 + dx, N / 2 - 70, 5, 0, Math.PI * 2); x.fill() })
  const t = tex(c, { srgb: true })
  t.wrapS = t.wrapT = ClampToEdgeWrapping
  return t
}

// Chest name tag
function nameTag(label) {
  const c = document.createElement('canvas')
  c.width = 512; c.height = 96
  const x = c.getContext('2d')
  x.fillStyle = '#1b1f24'; x.beginPath(); x.roundRect(0, 0, 512, 96, 18); x.fill()
  x.strokeStyle = '#c46a34'; x.lineWidth = 4; x.beginPath(); x.roundRect(6, 6, 500, 84, 14); x.stroke()
  x.fillStyle = '#e9e6df'; x.font = '800 60px "Big Shoulders Display", "Arial Narrow", sans-serif'
  x.textAlign = 'center'; x.textBaseline = 'middle'
  x.fillText(label, 256, 52)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  return t
}

let cache = null
export function suitTextures() {
  if (!cache) cache = { fabric: fabric(), shell: shell(), tread: tread(), patch: patch(), tag: nameTag('BOOVESHWARAN') }
  return cache
}
