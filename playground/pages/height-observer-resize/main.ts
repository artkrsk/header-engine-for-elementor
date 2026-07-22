import { Header } from '@engine'
import { buildHeader, buildPage } from '../../shared/fixtures'
import { mountHud } from '../../shared/hud'
import { scenario } from '../../shared/scenario'

scenario('height-observer-resize')

const { container, bar } = buildHeader({ sticky: { toggleReveal: false } })
document.body.appendChild(container)
document.body.appendChild(buildPage(6))

const header = new Header(container, bar)
header.init()
mountHud(container)

// Toggle the bar height at runtime → --arts-header-height should track it (ResizeObserver).
const controls = document.createElement('div')
controls.className = 'pg-controls'
const button = document.createElement('button')
button.id = 'toggle-height'
button.textContent = 'Toggle bar height'
let tall = false
button.addEventListener('click', () => {
  tall = !tall
  bar.style.height = tall ? '140px' : ''
})
controls.appendChild(button)
document.body.appendChild(controls)

Object.assign(window, { header, bar })
