import gsap from 'gsap'

const GLYPHS = '0123456789ABCDEF#%&*+=<>/\\[]{}'
const rand = () => GLYPHS[(Math.random() * GLYPHS.length) | 0]

// Resolve an element's text from random ciphertext glyphs to plaintext.
export function scramble(el, { duration = 0.9, delay = 0 } = {}) {
  const text = el.dataset.text ?? (el.dataset.text = el.textContent)
  const chars = [...text]
  const reveal = chars.map((_, i) => (i / chars.length) * 0.65 + Math.random() * 0.35)
  const state = { p: 0 }
  el._scr?.kill()
  el._scr = gsap.to(state, {
    p: 1,
    duration,
    delay,
    ease: 'none',
    onUpdate() {
      let out = ''
      for (let i = 0; i < chars.length; i++) {
        const c = chars[i]
        out += c === ' ' || state.p >= reveal[i] ? c : rand()
      }
      el.textContent = out
    },
    onComplete() { el.textContent = text },
  })
  return el._scr
}

// Hex "ciphertext" string of a given length, for loaders and labels.
export function cipherString(len) {
  let s = ''
  for (let i = 0; i < len; i++) s += i % 5 === 4 ? ' ' : '0123456789ABCDEF'[(Math.random() * 16) | 0]
  return s
}
