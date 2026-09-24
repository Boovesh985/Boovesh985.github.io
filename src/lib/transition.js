import gsap from 'gsap'
import { scramble } from './scramble.js'

// Curtain transitions between the home page and the case-study pages.
// Leaving: the curtain wipes up over the page and shows where you're going.
// Arriving: the next page loads under the curtain, which then lifts away.

const KEY = 'bt-transition'

export function initTransitions({ reduced }) {
  const curtain = document.querySelector('.curtain')
  const label = curtain?.querySelector('.curtain__label')
  const arriving = document.documentElement.classList.contains('is-arriving')

  function leave(url, title) {
    if (reduced || !curtain) { location.href = url; return }
    try { sessionStorage.setItem(KEY, '1') } catch {}
    if (label) { label.textContent = title || ''; label.dataset.text = title || '' }
    gsap.set(curtain, { visibility: 'visible' })
    const tl = gsap.timeline({ onComplete: () => { location.href = url } })
    tl.fromTo(curtain, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.85, ease: 'expo.inOut' })
      .fromTo(curtain.querySelector('.curtain__bar i'), { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: 'power2.inOut' }, 0.25)
    if (label && title) tl.add(() => scramble(label, { duration: 0.6 }), 0.3)
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-transition]')
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    const url = new URL(a.href, location.href)
    if (url.origin !== location.origin) return
    e.preventDefault()
    leave(url.href, a.dataset.transition)
  })

  // Returning via the back button restores a page from bfcache with the curtain down.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted && curtain) gsap.set(curtain, { clipPath: 'inset(0% 0% 100% 0%)', visibility: 'hidden' })
  })

  function arrive() {
    try { sessionStorage.removeItem(KEY) } catch {}
    if (!curtain) return Promise.resolve()
    return new Promise((resolve) => {
      gsap.timeline({ onComplete: () => { gsap.set(curtain, { visibility: 'hidden' }); resolve() } })
        .to(curtain, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.95, ease: 'expo.inOut', delay: 0.1 })
      setTimeout(resolve, 450) // start page intro while the curtain is still lifting
    })
  }

  return { arriving, arrive, leave }
}
