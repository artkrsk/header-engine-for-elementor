import '@styles/index.sass'
import './playground.scss'

/** Bootstraps a scenario page: sets the title and mounts the back-to-index nav. */
export function scenario(title: string): void {
  document.title = title
  const nav = document.createElement('nav')
  nav.className = 'pg-nav'
  nav.innerHTML = `<a href="/">← index</a><strong>${title}</strong>`
  document.body.appendChild(nav)
}
