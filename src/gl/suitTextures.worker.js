import { suitImages } from './suitImages.js'

// Draws the suit textures off the main thread and hands back raw pixels (plain memory,
// so every WebGL context on the page can upload them).
const imgs = suitImages({ makeCanvas: (n) => new OffscreenCanvas(n, n), flipped: true })
const out = {}
const transfer = []
for (const [part, maps] of Object.entries(imgs)) {
  out[part] = {}
  for (const [k, c] of Object.entries(maps)) {
    const { data, width, height } = c.getContext('2d').getImageData(0, 0, c.width, c.height)
    out[part][k] = { data, width, height }
    transfer.push(data.buffer)
  }
}
self.postMessage(out, transfer)
