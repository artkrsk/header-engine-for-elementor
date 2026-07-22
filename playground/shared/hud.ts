const STATE_CLASSES = ['sticky', 'revealing', 'scrolling-down', 'hidden', 'locked']

/** Live readout of the header's state classes + the height CSS vars (for eyeballing + MCP checks). */
export function mountHud(container: HTMLElement): void {
  const el = document.createElement('div')
  el.className = 'pg-hud'
  el.id = 'pg-hud'
  document.body.appendChild(el)

  const paint = (): void => {
    const cs = getComputedStyle(document.documentElement)
    const active = STATE_CLASSES.filter((c) => container.classList.contains(`arts-header_${c}`))
    el.innerHTML = [
      `state: ${active.join(' ') || '—'}`,
      `--height: ${cs.getPropertyValue('--arts-header-height').trim() || '—'}`,
      `--non-sticky: ${cs.getPropertyValue('--arts-header-height-non-sticky').trim() || '—'}`,
      `scrollY: ${Math.round(window.scrollY)}`
    ].join('<br>')
    requestAnimationFrame(paint)
  }
  paint()
}
