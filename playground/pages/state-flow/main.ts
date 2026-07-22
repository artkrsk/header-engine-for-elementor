import { Header } from '@engine'
import { mountCls } from '../../shared/cls'
import { buildHeader, buildPage, injectStyle } from '../../shared/fixtures'
import { mountHud } from '../../shared/hud'
import { scenario } from '../../shared/scenario'

scenario('state-flow')

// In-flow (sticky) header at CONSTANT height that swaps background + text color once stuck. Height
// stays constant, so page content never shifts (CLS 0). Height-changing switches belong in overlay
// mode (state-overlay) — a flow header that shrank its box would reflow everything below it.
injectStyle(`
  .arts-header__bar {
    background: #ffffff;
    color: #111;
    border-bottom: 1px solid #eaeaea;
  }
  .arts-header__bar .pg-logo {
    color: inherit;
  }
  .arts-header_sticky .arts-header__bar {
    background: #0b1220;
    color: #fff;
    border-bottom-color: transparent;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
  }
`)

const { container, bar } = buildHeader({ mode: 'flow', sticky: { toggleReveal: false } })
document.body.appendChild(container)
document.body.appendChild(buildPage(6))

const header = new Header(container, bar)
header.init()
mountHud(container)
mountCls()

Object.assign(window, { header, bar })
