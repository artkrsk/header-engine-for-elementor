import { Header } from '@engine'
import { buildHeader, buildPage } from '../../shared/fixtures'
import { mountHud } from '../../shared/hud'
import { scenario } from '../../shared/scenario'

scenario('reveal-auto-hide')

// Reveal enabled (default): scroll down past the bar → hides; scroll up → reveals.
const { container, bar } = buildHeader({ sticky: { toggleReveal: true, revealMode: 'auto-hide' } })
document.body.appendChild(container)
document.body.appendChild(buildPage(8))

const header = new Header(container, bar)
header.init()
mountHud(container)

Object.assign(window, { header })
