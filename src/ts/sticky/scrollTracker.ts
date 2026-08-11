import { SETTLE_DEBOUNCE_MS } from '../constants'
import { debounce } from '../utils'
import { clampScroll, readMaxScroll } from './scrollBounds'

/**
 * The one passive scroll listener + rAF coalescer driving direction ticks. Document bounds are
 * cached so the hot path never forces layout; they refresh on `refreshBounds()` (wired to engine
 * updates) and on a settled window resize — mobile URL-bar show/hide changes the viewport exactly
 * while scrolling happens.
 */
export function createScrollTracker(onTick: (y: number, delta: number) => void): {
  /** Current clamped scroll position, read fresh (does not disturb the tick baseline). */
  readY(): number
  refreshBounds(): void
  destroy(): void
} {
  let maxScroll = readMaxScroll()
  // Seed so the first real delta reflects true direction rather than a zero baseline.
  let lastY = clampScroll(window.scrollY, maxScroll)
  let rafId = 0
  let queued = false

  const processScroll = (): void => {
    queued = false
    const y = clampScroll(window.scrollY, maxScroll)
    const delta = y - lastY
    lastY = y
    onTick(y, delta)
  }

  const onScroll = (): void => {
    if (queued) {
      return
    }
    queued = true
    rafId = requestAnimationFrame(processScroll)
  }

  const refreshBounds = (): void => {
    maxScroll = readMaxScroll()
  }
  const onResize = debounce(refreshBounds, SETTLE_DEBOUNCE_MS)

  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onResize, { passive: true })

  return {
    readY: () => clampScroll(window.scrollY, maxScroll),
    refreshBounds,
    destroy() {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(rafId)
      queued = false
    }
  }
}
