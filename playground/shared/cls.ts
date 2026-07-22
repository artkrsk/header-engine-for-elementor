/**
 * Live Cumulative Layout Shift meter — the browser's own authority on unexpected reflow. The
 * state-styling demos must keep this at 0: switching background/padding on the sticky header must
 * never shift page content. Exposes `window.__getCls()` for automated verification.
 */
export function mountCls(): void {
  let cls = 0
  const el = document.createElement('div')
  el.className = 'pg-cls'
  el.id = 'pg-cls'
  document.body.appendChild(el)

  const render = (): void => {
    el.textContent = `CLS: ${cls.toFixed(4)}`
    el.classList.toggle('pg-cls_bad', cls > 0.001)
  }
  render()

  if ('PerformanceObserver' in window) {
    try {
      const po = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // Count every shift (programmatic scroll isn't user input, so these are "real").
          const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean }
          if (!shift.hadRecentInput) {
            cls += shift.value
          }
        }
        render()
      })
      po.observe({ type: 'layout-shift', buffered: true })
    } catch {
      // layout-shift not supported — leave the meter at 0.
    }
  }

  ;(window as unknown as { __getCls: () => number }).__getCls = () => cls
}
