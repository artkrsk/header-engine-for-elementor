import { Header } from '@engine'
import { buildHeader, makeSection, zoneSection } from '../../shared/fixtures'
import { mountHud } from '../../shared/hud'
import { scenario } from '../../shared/scenario'

scenario('zones-cover')

// Combined test: scroll-bound reveal (hide-on-down / reveal-on-up) AND a hide-over zone active
// together — to see how the two hide sources interact. Swap reveal mode via the button (reloads).
const revealMode =
  new URLSearchParams(location.search).get('reveal') === 'scrub' ? 'scrub' : 'auto-hide'

const { container, bar } = buildHeader({ sticky: { toggleReveal: true, revealMode } })
document.body.appendChild(container)

const main = document.createElement('main')
main.appendChild(makeSection('scroll down → header hides · scroll up → reveals'))
main.appendChild(makeSection('section 2'))
main.appendChild(
  zoneSection(
    'hide',
    'cover',
    `HIDE-OVER ZONE (cover) — header force-hidden while this fills the viewport · reveal: ${revealMode}`
  )
)
// Several tall sections after the zone so there's room to scroll down/up and watch the reveal
// resume once you're past the hide-over zone.
main.appendChild(makeSection('after zone 1 — scroll down here → hides · scroll up → reveals'))
main.appendChild(makeSection('after zone 2'))
main.appendChild(makeSection('after zone 3'))
main.appendChild(makeSection('after zone 4'))
document.body.appendChild(main)

const header = new Header(container, bar)
header.init()
mountHud(container)

// Swap reveal mode (reload with the other mode) to test both auto-hide and scrub against the zone.
const swap = document.createElement('button')
swap.type = 'button'
swap.className = 'pg-swap'
swap.textContent = `Reveal: ${revealMode} — switch to ${revealMode === 'scrub' ? 'auto-hide' : 'scrub'}`
swap.addEventListener('click', () => {
  location.search = revealMode === 'scrub' ? '' : '?reveal=scrub'
})
document.body.appendChild(swap)

Object.assign(window, { header })
