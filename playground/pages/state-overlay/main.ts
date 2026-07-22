import { Header } from '@engine'
import { mountCls } from '../../shared/cls'
import { buildHeader, buildPage, heroSection, injectStyle } from '../../shared/fixtures'
import { mountHud } from '../../shared/hud'
import { scenario } from '../../shared/scenario'

scenario('state-overlay')

// The most common real-world case: a transparent header over a fullscreen hero that gains a
// background and shrinks its vertical padding once stuck. Overlay mode keeps it out of flow, so the
// shrink never reflows the page — watch the CLS meter (top-right) stay at 0.
injectStyle(`
  .arts-header {
    --arts-header-non-sticky-spacing-vertical: 34px;
    --arts-header-sticky-spacing-vertical: 10px;
  }
  .arts-header__bar {
    height: auto;
    padding-top: var(--arts-header-spacing-vertical);
    padding-bottom: var(--arts-header-spacing-vertical);
    background: transparent;
    box-shadow: none;
  }
  .arts-header_sticky .arts-header__bar {
    background: #0b1220;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.28);
  }
`)

const { container, bar } = buildHeader(
  { mode: 'overlay', sticky: { toggleReveal: false } },
  { mode: 'overlay' }
)
document.body.appendChild(container)

const main = document.createElement('main')
main.appendChild(heroSection('FULLSCREEN HERO'))
main.appendChild(buildPage(5))
document.body.appendChild(main)

const header = new Header(container, bar)
header.init()
mountHud(container)
mountCls()

Object.assign(window, { header, bar })
