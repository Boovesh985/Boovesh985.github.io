// Point-cloud targets the particle field morphs between.
// Each returns a Float32Array of length count * 3.

const TAU = Math.PI * 2

function rotate(arr, rx, ry, rz = 0) {
  const cx = Math.cos(rx), sx = Math.sin(rx)
  const cy = Math.cos(ry), sy = Math.sin(ry)
  const cz = Math.cos(rz), sz = Math.sin(rz)
  for (let i = 0; i < arr.length; i += 3) {
    let x = arr[i], y = arr[i + 1], z = arr[i + 2]
    let y1 = y * cx - z * sx, z1 = y * sx + z * cx
    let x2 = x * cy + z1 * sy, z2 = -x * sy + z1 * cy
    let x3 = x2 * cz - y1 * sz, y3 = x2 * sz + y1 * cz
    arr[i] = x3; arr[i + 1] = y3; arr[i + 2] = z2
  }
  return arr
}

// Shapes built in parts (heart + trace, reel + strip) are shuffled point by point, so when a slow
// device draws only the first part of the buffer, every part of the shape survives.
function shuffle(arr) {
  for (let i = arr.length / 3 - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0
    for (let k = 0; k < 3; k++) { const t = arr[i * 3 + k]; arr[i * 3 + k] = arr[j * 3 + k]; arr[j * 3 + k] = t }
  }
  return arr
}

function onSphere() {
  const u = Math.random() * 2 - 1
  const t = Math.random() * TAU
  const r = Math.sqrt(1 - u * u)
  return [r * Math.cos(t), r * Math.sin(t), u]
}

// 0 — Hero: a dense sphere with an orbiting ring.
export function sphere(n) {
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const k = Math.random()
    let x, y, z
    if (k < 0.8) {
      const [sx, sy, sz] = onSphere()
      const r = 1.35 + (Math.random() - 0.5) * 0.04
      x = sx * r; y = sy * r; z = sz * r
    } else if (k < 0.88) {
      const [sx, sy, sz] = onSphere()
      const r = Math.cbrt(Math.random()) * 1.2
      x = sx * r; y = sy * r; z = sz * r
    } else {
      const t = Math.random() * TAU
      const r = 2.05 + (Math.random() - 0.5) * 0.28 * Math.random()
      x = Math.cos(t) * r; y = (Math.random() - 0.5) * 0.02; z = Math.sin(t) * r
      // tilt the ring
      const ty = y * Math.cos(0.42) - z * Math.sin(0.42)
      const tz = y * Math.sin(0.42) + z * Math.cos(0.42)
      y = ty; z = tz
    }
    a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z
  }
  return rotate(a, 0, 0, -0.18)
}

// 1 — Steel: a bundle of hollow round and square pipes.
export function pipes(n) {
  const a = new Float32Array(n * 3)
  const L = 3.6
  const tubes = []
  const sp = 0.78
  for (let r = -1; r <= 1; r++) {
    for (let c = -1; c <= 1; c++) {
      tubes.push({ y: r * sp, z: c * sp + (r % 2 ? sp * 0.18 : 0), square: (r + c + 2) % 3 === 0, R: 0.32, off: (Math.random() - 0.5) * 0.7 })
    }
  }
  for (let i = 0; i < n; i++) {
    const tb = tubes[(Math.random() * tubes.length) | 0]
    const k = Math.random()
    let px, py, pz
    const endCap = k < 0.22
    const t = endCap ? (Math.random() < 0.5 ? -L / 2 : L / 2) : (Math.random() - 0.5) * L
    let rad = tb.R
    if (endCap) rad = tb.R * (0.78 + Math.random() * 0.22)
    else if (k > 0.9) rad = tb.R * 0.8 // faint inner wall
    if (tb.square) {
      // perimeter of a square with half-size rad
      const s = Math.random() * 4
      const side = s | 0, f = (s - side) * 2 - 1
      const h = rad * 0.92
      if (side === 0) { py = f * h; pz = h }
      else if (side === 1) { py = h; pz = f * h }
      else if (side === 2) { py = f * h; pz = -h }
      else { py = -h; pz = f * h }
    } else {
      const th = Math.random() * TAU
      py = Math.cos(th) * rad; pz = Math.sin(th) * rad
    }
    px = t + tb.off
    a[i * 3] = px; a[i * 3 + 1] = py + tb.y; a[i * 3 + 2] = pz + tb.z
  }
  return rotate(a, 0.35, -0.75, 0.22)
}

// 2 — Agents: the clinical reasoning graph (nodes + edges).
export function network(n) {
  const a = new Float32Array(n * 3)
  const N = {
    query: [-2.5, 0.2, 0.0, 0.12],
    cag: [-1.6, 0.95, 0.25, 0.16],
    planner: [-1.35, -0.55, -0.1, 0.26],
    research: [-0.3, -0.35, 0.35, 0.3],
    review: [0.65, -0.45, -0.25, 0.3],
    refine: [0.8, 0.8, 0.15, 0.24],
    advise: [1.75, -0.15, 0.1, 0.28],
    answer: [2.55, 0.55, 0.0, 0.14],
    faiss: [-0.25, -1.45, 0.0, 0.2],
  }
  const E = [
    ['query', 'cag'], ['cag', 'planner'], ['cag', 'answer'], ['planner', 'research'], ['research', 'review'],
    ['review', 'refine'], ['refine', 'review'], ['review', 'advise'], ['advise', 'answer'], ['faiss', 'research'],
  ]
  const nodes = Object.values(N)
  for (let i = 0; i < n; i++) {
    let x, y, z
    if (Math.random() < 0.58) {
      const nd = nodes[(Math.random() * nodes.length) | 0]
      const [sx, sy, sz] = onSphere()
      const r = nd[3] * (Math.random() < 0.85 ? 1 : Math.cbrt(Math.random()))
      x = nd[0] + sx * r; y = nd[1] + sy * r; z = nd[2] + sz * r
    } else {
      const [p, q] = E[(Math.random() * E.length) | 0]
      const A = N[p], B = N[q]
      const t = Math.random()
      // curved edge (quadratic bezier bulging in z/y)
      const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2 + 0.18, mz = (A[2] + B[2]) / 2 + 0.3
      const u = 1 - t
      x = u * u * A[0] + 2 * u * t * mx + t * t * B[0]
      y = u * u * A[1] + 2 * u * t * my + t * t * B[1]
      z = u * u * A[2] + 2 * u * t * mz + t * t * B[2]
      const j = 0.018
      x += (Math.random() - 0.5) * j; y += (Math.random() - 0.5) * j; z += (Math.random() - 0.5) * j
    }
    a[i * 3] = x * 0.92; a[i * 3 + 1] = y * 0.92; a[i * 3 + 2] = z * 0.92
  }
  return rotate(a, 0.12, -0.28, 0)
}

// ECG waveform (one beat per unit), roughly P-QRS-T.
function ecg(t) {
  const f = t - Math.floor(t)
  const g = (m, s, h) => h * Math.exp(-((f - m) ** 2) / (2 * s * s))
  return g(0.18, 0.025, 0.12) + g(0.33, 0.008, -0.1) + g(0.36, 0.01, 0.95) + g(0.39, 0.009, -0.22) + g(0.62, 0.045, 0.24)
}

// 3 — ECG: a heart surface crossed by a heartbeat trace.
export function heart(n) {
  const a = new Float32Array(n * 3)
  const nHeart = Math.floor(n * 0.76)
  let i = 0
  const s = 1.15
  while (i < nHeart) {
    const x = (Math.random() * 2 - 1) * 1.3
    const y = (Math.random() * 2 - 1) * 0.9
    const z = (Math.random() * 2 - 1) * 1.4
    const q = x * x + 2.25 * y * y + z * z - 1
    const F = q * q * q - x * x * z * z * z - 0.1125 * y * y * z * z * z
    if (F < 0 && F > -0.035) {
      a[i * 3] = x * s; a[i * 3 + 1] = z * s + 0.1; a[i * 3 + 2] = y * s
      i++
    }
  }
  for (; i < n; i++) {
    const t = Math.random()
    const x = (t - 0.5) * 3.6
    const y = -1.55 + ecg(t * 2 + 0.1) * 0.9
    a[i * 3] = x + (Math.random() - 0.5) * 0.01
    a[i * 3 + 1] = y + (Math.random() - 0.5) * 0.02
    a[i * 3 + 2] = 0.4 + (Math.random() - 0.5) * 0.04
  }
  return shuffle(rotate(a, 0.05, 0, 0))
}

// 4 — Spiral: a three-arm disc for the closing sections.
export function spiral(n) {
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const arm = (i % 3) * (TAU / 3)
    const r = Math.pow(Math.random(), 0.55) * 3.0
    const ang = arm + r * 1.35 + (Math.random() - 0.5) * (0.5 / (r + 0.4))
    const spread = (Math.random() - 0.5) * 0.18 * (1 + r * 0.25)
    a[i * 3] = Math.cos(ang) * r + spread
    a[i * 3 + 1] = (Math.random() - 0.5) * 0.12 * (1.2 - r / 3)
    a[i * 3 + 2] = Math.sin(ang) * r + spread
  }
  return rotate(a, 1.05, 0, 0.3)
}

// 5 — Moviq: a film reel with a strip of film unspooling from it.
export function reel(n) {
  const a = new Float32Array(n * 3)
  const R = 1.3
  const holes = Array.from({ length: 5 }, (_, k) => {
    const t = (k / 5) * TAU + 0.3
    return [Math.cos(t) * 0.74, Math.sin(t) * 0.74]
  })
  const HR = 0.29
  const inHole = (x, y) => holes.some(([hx, hy]) => (x - hx) ** 2 + (y - hy) ** 2 < HR * HR)
  const cx = -0.95, cy = 0.25 // reel centre; the strip runs off to the right
  const nReel = Math.floor(n * 0.62)
  let i = 0
  while (i < nReel) {
    const k = Math.random()
    let x, y
    if (k < 0.34) {
      // outlines: rim, the five windows, the hub
      const o = Math.random()
      const t = Math.random() * TAU
      if (o < 0.45) { const r = R - Math.random() * 0.05; x = Math.cos(t) * r; y = Math.sin(t) * r }
      else if (o < 0.88) { const [hx, hy] = holes[(Math.random() * 5) | 0]; x = hx + Math.cos(t) * HR; y = hy + Math.sin(t) * HR }
      else { const r = 0.2; x = Math.cos(t) * r; y = Math.sin(t) * r }
    } else {
      // the face of the reel, with the windows and the axle left open
      const r = Math.sqrt(Math.random()) * R
      const t = Math.random() * TAU
      x = Math.cos(t) * r; y = Math.sin(t) * r
      if (r < 0.1 || inHole(x, y)) continue
    }
    const z = (Math.random() < 0.5 ? -1 : 1) * 0.06 + (Math.random() - 0.5) * 0.015
    a[i * 3] = x + cx; a[i * 3 + 1] = y + cy; a[i * 3 + 2] = z
    i++
  }
  // the strip leaves the bottom of the reel, runs right and curls through depth
  const a0 = -1.25
  const P = [cx + Math.cos(a0) * R, cy + Math.sin(a0) * R]
  const L = 3.4, W = 0.24, frames = 11
  for (; i < n; i++) {
    let s = Math.random(), u
    const k = Math.random()
    if (k < 0.42) u = (Math.random() < 0.5 ? -1 : 1) * (0.97 + Math.random() * 0.03) // edges
    else if (k < 0.62) { s = (Math.round(s * frames) + (Math.random() - 0.5) * 0.04) / frames; u = Math.random() * 1.3 - 0.65 } // frame lines
    else {
      u = Math.random() * 2 - 1
      // sprocket holes along both edges
      if (Math.abs(u) > 0.74 && Math.abs(u) < 0.9 && ((s * frames * 3) % 1) < 0.5) { i--; continue }
    }
    const x = P[0] + s * L
    const y = P[1] + Math.sin(s * Math.PI * 1.2) * 0.55 - s * 0.35
    const z = Math.sin(s * Math.PI) * 0.7
    const tw = s * 1.1 // the strip twists as it travels
    a[i * 3] = x
    a[i * 3 + 1] = y + u * W * Math.cos(tw)
    a[i * 3 + 2] = z + u * W * Math.sin(tw)
  }
  return shuffle(rotate(a, 0.22, -0.32, 0.04))
}
