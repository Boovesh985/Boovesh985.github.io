import { CanvasTexture, ClampToEdgeWrapping, DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace } from 'three'
import { suitImages } from './suitImages.js'

// Procedural textures for the spacesuit, made once and shared by every renderer.
// The heavy tileable maps are drawn in a worker; the lettered patch and name tag need
// the page's fonts, so they're drawn here (they're small).

const canvas = (n) => {
  const c = document.createElement('canvas')
  c.width = c.height = n
  return c
}

function tex(img, { srgb = false, repeat = 1 } = {}) {
  let t
  if (img.data) {
    // raw pixels from the worker: row 0 is the texture's bottom edge (the worker drew for that)
    t = new DataTexture(new Uint8Array(img.data.buffer), img.width, img.height)
    t.magFilter = LinearFilter
    t.minFilter = LinearMipmapLinearFilter
    t.generateMipmaps = true
    t.needsUpdate = true
  } else t = new CanvasTexture(img)
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(repeat, repeat)
  t.anisotropy = 8
  if (srgb) t.colorSpace = SRGBColorSpace
  return t
}

function drawInWorker() {
  return new Promise((resolve, reject) => {
    if (typeof OffscreenCanvas === 'undefined') return reject(new Error('no OffscreenCanvas'))
    const w = new Worker(new URL('./suitTextures.worker.js', import.meta.url), { type: 'module' })
    w.onmessage = (e) => { resolve(e.data); w.terminate() }
    w.onerror = (e) => { reject(e); w.terminate() }
  })
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
let loading = null

// Starts drawing (once) and resolves when the textures are ready.
export function loadSuitTextures() {
  if (!loading) {
    loading = drawInWorker()
      .catch(() => suitImages({ makeCanvas: canvas })) // no worker canvas: draw on the page instead
      .then(({ fabric: f, shell: s, tread: t }) => {
        cache = {
          fabric: { map: tex(f.map, { srgb: true, repeat: 2 }), normalMap: tex(f.normalMap, { repeat: 2 }), roughnessMap: tex(f.roughnessMap, { repeat: 2 }) },
          shell: { normalMap: tex(s.normalMap), roughnessMap: tex(s.roughnessMap) },
          tread: { normalMap: tex(t.normalMap, { repeat: 2 }) },
          patch: patch(),
          tag: nameTag('BOOVESHWARAN'),
        }
        return cache
      })
  }
  return loading
}

export function suitTextures() {
  if (!cache) throw new Error('loadSuitTextures() must finish first')
  return cache
}
