import { Header } from '@engine'
import { buildHeader, buildPage } from '../../shared/fixtures'
import { mountHud } from '../../shared/hud'
import { scenario } from '../../shared/scenario'

scenario('sticky-basic')

// Simple sticky (no reveal): the wrapper pins natively; JS adds `arts-header_sticky` + fires events.
const { container, bar } = buildHeader({ sticky: { toggleReveal: false } })
document.body.appendChild(container)
document.body.appendChild(buildPage(6))

const header = new Header(container, bar)
header.init()
mountHud(container)

Object.assign(window, { header })
