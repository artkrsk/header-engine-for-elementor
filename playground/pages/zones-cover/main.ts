import { Header } from '@engine'
import { buildHeader, makeSection, zoneSection } from '../../shared/fixtures'
import { mountHud } from '../../shared/hud'
import { scenario } from '../../shared/scenario'

scenario('zones-cover')

const { container, bar } = buildHeader({ sticky: { toggleReveal: true } })
document.body.appendChild(container)

const main = document.createElement('main')
main.appendChild(makeSection('section 1'))
main.appendChild(makeSection('section 2'))
// The header hides only once this zone's top crosses the viewport top (it fills the screen).
main.appendChild(
  zoneSection('hide', 'cover', 'HIDE-OVER ZONE (cover) — header hides once this fills the viewport')
)
main.appendChild(makeSection('section after zone'))
document.body.appendChild(main)

const header = new Header(container, bar)
header.init()
mountHud(container)

Object.assign(window, { header })
