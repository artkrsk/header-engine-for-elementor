import Lenis from 'lenis'

// Playground-only smooth-scroll toggle. Lenis smooths the NATIVE scroll (it drives window scroll
// and fires real scroll events), so the header engine needs no adapter — it reads window.scrollY
// exactly as usual. This toggle exists to verify that claim live.

let lenis: Lenis | null = null
let rafId = 0

function ensureLenisStyles(): void {
  if (document.getElementById('pg-lenis-css')) {
    return
  }
  const style = document.createElement('style')
  style.id = 'pg-lenis-css'
  style.textContent = `
    html.lenis, html.lenis body { height: auto; }
    .lenis.lenis-smooth { scroll-behavior: auto !important; }
    .lenis.lenis-smooth [data-lenis-prevent] { overscroll-behavior: contain; }
    .lenis.lenis-stopped { overflow: hidden; }
  `
  document.head.appendChild(style)
}

function start(): void {
  if (lenis) {
    return
  }
  ensureLenisStyles()
  lenis = new Lenis()
  // Exposed for console/automated testing — Lenis fights native window.scrollTo, so drive scrolls
  // via `window.__pgLenis.scrollTo(y)` when smooth scroll is on.
  ;(window as unknown as { __pgLenis?: Lenis | undefined }).__pgLenis = lenis
  const raf = (time: number): void => {
    lenis?.raf(time)
    rafId = requestAnimationFrame(raf)
  }
  rafId = requestAnimationFrame(raf)
}

function stop(): void {
  cancelAnimationFrame(rafId)
  lenis?.destroy()
  lenis = null
  ;(window as unknown as { __pgLenis?: Lenis | undefined }).__pgLenis = undefined
}

/** Mounts a fixed toggle button (bottom-right) to run the page under Lenis. */
export function mountLenisToggle(): void {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'pg-lenis'

  const label = (on: boolean): void => {
    btn.textContent = on ? 'Lenis: ON' : 'Lenis: OFF'
    btn.classList.toggle('pg-lenis_on', on)
  }
  label(false)

  btn.addEventListener('click', () => {
    if (lenis) {
      stop()
      label(false)
    } else {
      start()
      label(true)
    }
  })

  document.body.appendChild(btn)
}
