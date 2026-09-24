import gsap from 'gsap'

// Tile of hex "ciphertext" used as the fill of the encrypted layer.
export function cipherTexture(color) {
  const c = document.createElement('canvas')
  const dpr = Math.min(devicePixelRatio, 2)
  c.width = 360 * dpr; c.height = 180 * dpr
  const x = c.getContext('2d')
  x.scale(dpr, dpr)
  x.fillStyle = color
  x.font = '400 7px "Martian Mono", ui-monospace, monospace'
  x.textBaseline = 'top'
  const hex = '0123456789ABCDEF'
  for (let row = 0; row < 20; row++) {
    let s = ''
    for (let i = 0; i < 60; i++) s += i % 9 === 8 ? ' ' : hex[(Math.random() * 16) | 0]
    x.globalAlpha = 0.3 + Math.random() * 0.45
    x.fillText(s, 2, row * 9 + 1)
  }
  return `url(${c.toDataURL()})`
}

// Cursor-trail mask that reveals the plaintext layer under the ciphertext.
export function initDecrypt(root, gl) {
  const plain = root.querySelector('.hero__layer--plain')
  const cipher = root.querySelector('.hero__layer--cipher')
  if (!plain) return { sweep() {} }

  const setTexture = () => {
    const col = getComputedStyle(document.documentElement).getPropertyValue('--fg').trim() || '#0e1114'
    cipher.style.setProperty('--cipher-tex', cipherTexture(col))
  }
  document.fonts.ready.then(setTexture)
  setTexture()
  new MutationObserver(setTexture).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

  const pts = []
  let head = null
  let last = null
  let rect = plain.getBoundingClientRect()
  let visible = true
  let fs = parseFloat(getComputedStyle(plain).fontSize) || 100
  const refresh = () => { rect = plain.getBoundingClientRect(); fs = parseFloat(getComputedStyle(plain).fontSize) || fs }
  window.addEventListener('resize', refresh)
  window.addEventListener('scroll', () => { rect = plain.getBoundingClientRect() }, { passive: true })
  new IntersectionObserver(([e]) => { visible = e.isIntersecting }).observe(root)

  function add(cx, cy) {
    refresh()
    const pad = fs * 0.5
    const inside = cx > rect.left - pad && cx < rect.right + pad && cy > rect.top - pad && cy < rect.bottom + pad
    head = inside ? { x: cx - rect.left, y: cy - rect.top } : null
    if (!inside) { last = null; return }
    const p = { x: cx - rect.left, y: cy - rect.top }
    if (last) {
      const dx = p.x - last.x, dy = p.y - last.y
      const d = Math.hypot(dx, dy)
      const step = fs * 0.1
      const n = Math.min(Math.floor(d / step), 12)
      for (let i = 1; i <= n; i++) pts.push({ x: last.x + (dx * i) / (n + 1), y: last.y + (dy * i) / (n + 1), life: 1 })
    }
    pts.push({ ...p, life: 1 })
    while (pts.length > 60) pts.shift()
    last = p
  }

  window.addEventListener('pointermove', (e) => add(e.clientX, e.clientY), { passive: true })
  window.addEventListener('pointerleave', () => { head = null; last = null })

  let cleared = true
  gsap.ticker.add(() => {
    if (!visible) return
    for (const p of pts) p.life -= 0.016
    while (pts.length && pts[0].life <= 0) pts.shift()
    if (!pts.length && !head) {
      if (!cleared) { plain.style.maskImage = plain.style.webkitMaskImage = 'linear-gradient(transparent, transparent)'; cleared = true }
      return
    }
    cleared = false
    const R = fs * 0.55
    const layers = pts.map((p) => {
      const r = R * (0.35 + 0.65 * Math.pow(p.life, 0.7))
      return `radial-gradient(circle ${r.toFixed(1)}px at ${p.x.toFixed(1)}px ${p.y.toFixed(1)}px, #000 30%, transparent 100%)`
    })
    if (head) layers.push(`radial-gradient(circle ${R.toFixed(1)}px at ${head.x.toFixed(1)}px ${head.y.toFixed(1)}px, #000 35%, transparent 100%)`)
    const m = layers.join(',')
    plain.style.maskImage = m
    plain.style.webkitMaskImage = m
  })

  // A scripted pass of the "torch" across the name, used on load and for touch devices.
  function sweep(duration = 1.8) {
    refresh()
    const o = { t: 0 }
    return gsap.to(o, {
      t: 1, duration, ease: 'power1.inOut',
      onUpdate() {
        const x = rect.left - rect.width * 0.05 + o.t * rect.width * 1.1
        const y = rect.top + rect.height * (0.5 + Math.sin(o.t * Math.PI * 3) * 0.3)
        add(x, y)
        gl?.feedPointer(x, y)
      },
      onComplete() { head = null; last = null },
    })
  }

  return { sweep }
}
