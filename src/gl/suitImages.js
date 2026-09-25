// Tileable spacesuit images (fabric weave, shell panels, rubber tread), drawn with 2D canvas.
// Pure drawing code: runs inside a worker (OffscreenCanvas) or, as a fallback, on the page.

let canvas = null
// Images handed over as ImageBitmaps aren't flipped on upload, so the normal maps' green channel flips instead.
let flipSign = 1

// Seeded noise so the suit looks the same on every visit
let seed = 11
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646

// Height map (grey canvas) → tangent-space normal map
function toNormal(h, strength) {
  const sign = flipSign
  const n = h.width
  const src = h.getContext('2d').getImageData(0, 0, n, n).data
  const out = canvas(n)
  const ctx = out.getContext('2d')
  const img = ctx.createImageData(n, n)
  const d = img.data
  const m = n - 1 // n is a power of two: wrap with a mask
  for (let y = 0; y < n; y++) {
    const up = ((y - 1) & m) * n, row = y * n, down = ((y + 1) & m) * n
    for (let x = 0; x < n; x++) {
      const l = (x - 1) & m, r = (x + 1) & m
      const dx = (src[(row + r) * 4] - src[(row + l) * 4]) * (strength / 255)
      const dy = (src[(down + x) * 4] - src[(up + x) * 4]) * (strength / 255)
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1)
      const i = (row + x) * 4
      d[i] = (-dx * inv * 0.5 + 0.5) * 255
      d[i + 1] = (sign * dy * inv * 0.5 + 0.5) * 255
      d[i + 2] = (inv * 0.5 + 0.5) * 255
      d[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return out
}

function blurred(c, px) {
  const o = canvas(c.width)
  // kept on the CPU: toNormal reads it back, and a GPU readback stalls the page
  const x = o.getContext('2d', { willReadFrequently: true })
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
  // basket weave: one 8×8 tile, repeated
  const tile = canvas(8)
  const tx = tile.getContext('2d')
  for (let py = 0; py < 8; py += 4) {
    for (let px = 0; px < 8; px += 4) {
      const across = ((px >> 2) + (py >> 2)) % 2
      const g = tx.createLinearGradient(px, py, across ? px + 4 : px, across ? py : py + 4)
      g.addColorStop(0, '#6c6c6c'); g.addColorStop(0.5, '#a2a2a2'); g.addColorStop(1, '#6c6c6c')
      tx.fillStyle = g
      tx.fillRect(px + 0.3, py + 0.3, 3.4, 3.4)
    }
  }
  x.fillStyle = x.createPattern(tile, 'repeat')
  x.fillRect(0, 0, N, N)
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
  return { map: a, normalMap: normal, roughnessMap: blurred(r, 1) }
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
  return { normalMap: toNormal(blurred(h, 0.8), 3), roughnessMap: blurred(r, 0.5) }
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
  return { normalMap: toNormal(blurred(h, 1), 3) }
}

export function suitImages({ makeCanvas, flipped = false }) {
  canvas = makeCanvas
  flipSign = flipped ? -1 : 1
  seed = 11
  return { fabric: fabric(), shell: shell(), tread: tread() }
}
