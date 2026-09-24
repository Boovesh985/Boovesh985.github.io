import gsap from 'gsap'

export function initCursor() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
  const el = document.querySelector('.cursor')
  if (!el) return
  document.documentElement.classList.add('has-cursor')
  const dot = el.querySelector('.cursor__dot')
  const ring = el.querySelector('.cursor__ring')
  const label = el.querySelector('.cursor__label')
  const pos = { x: innerWidth / 2, y: innerHeight / 2 }
  const ringPos = { ...pos }
  const setDot = { x: gsap.quickSetter(dot, 'x', 'px'), y: gsap.quickSetter(dot, 'y', 'px') }
  const setRing = { x: gsap.quickSetter(ring, 'x', 'px'), y: gsap.quickSetter(ring, 'y', 'px') }

  window.addEventListener('pointermove', (e) => {
    pos.x = e.clientX; pos.y = e.clientY
    setDot.x(pos.x); setDot.y(pos.y)
    el.classList.remove('is-hidden')
  }, { passive: true })
  document.addEventListener('pointerleave', () => el.classList.add('is-hidden'))

  gsap.ticker.add(() => {
    ringPos.x += (pos.x - ringPos.x) * 0.18
    ringPos.y += (pos.y - ringPos.y) * 0.18
    setRing.x(ringPos.x); setRing.y(ringPos.y)
  })

  document.addEventListener('pointerover', (e) => {
    const labelled = e.target.closest('[data-cursor]')
    const link = e.target.closest('a, button, [data-magnetic]')
    if (labelled) {
      label.textContent = labelled.dataset.cursor
      el.classList.add('is-label')
    } else el.classList.remove('is-label')
    el.classList.toggle('is-hover', !!link && !labelled)
  })
}
