import { Header } from '@engine'
import { buildHeader, buildPage } from '../../shared/fixtures'
import { mountHud } from '../../shared/hud'
import { scenario } from '../../shared/scenario'

scenario('reveal-scrub')

// Scrub reveal: the bar follows scroll 1:1 within a barHeight window (finger-following), rather
// than the binary snap of auto-hide.
const { container, bar } = buildHeader({ sticky: { toggleReveal: true, revealMode: 'scrub' } })
document.body.appendChild(container)
document.body.appendChild(buildPage(8))

const header = new Header(container, bar)
header.init()
mountHud(container)

Object.assign(window, { header })
