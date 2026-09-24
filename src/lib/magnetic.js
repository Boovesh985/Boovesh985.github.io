import gsap from 'gsap'

export function initMagnetic() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' })
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' })
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect()
      xTo((e.clientX - (r.left + r.width / 2)) * 0.28)
      yTo((e.clientY - (r.top + r.height / 2)) * 0.35)
    })
    el.addEventListener('pointerleave', () => { xTo(0); yTo(0) })
  })
}
