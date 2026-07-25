import '@styles/index.sass'
import { mountLenisToggle } from './lenis'
import './playground.scss'

/** Bootstraps a scenario page: title, back-to-index nav, and the Lenis smooth-scroll toggle. */
export function scenario(title: string, options: { nav?: boolean } = {}): void {
  document.title = title
  if (options.nav !== false) {
    const nav = document.createElement('nav')
    nav.className = 'pg-nav'
    nav.innerHTML = `<a href="/">← index</a><strong>${title}</strong>`
    document.body.appendChild(nav)
  }
  mountLenisToggle()
}
