import { SETTLE_DEBOUNCE_MS } from '../constants'
import { coalesceToFrame, debounce } from '../utils'
import { clampScroll, readMaxScroll } from './scrollBounds'

/**
 * The page-level scroll bus — the engine's ONE deliberate module-scope singleton (everything else
 * is a factory). All header instances on a page share one passive scroll listener + rAF coalescer,
 * one cached bounds value, one settled-resize signal, and one document-growth ResizeObserver;
 * subscriptions are refcounted, and the last destroy detaches everything. Per realm by
 * construction, so the Elementor editor's preview iframe gets its own.
 *
 * Every subscriber receives the identical `(y, delta)` stream, clamped against the CACHED bounds
 * (never a layout read on the tick path). Bounds refresh on every subscribe (a late-booted
 * instance must not clamp against a document that has since grown), on `refreshBounds()`, on a
 * settled window resize — which then fans out `onSettledResize` — and on settled document growth,
 * which refreshes bounds ONLY (lazy content is a clamping concern, never a measure-pass trigger).
 */

interface IScrollSubscriber {
  onTick: (y: number, delta: number) => void
  onSettledResize?: () => void
}

const subscribers = new Set<IScrollSubscriber>()
let maxScroll = 0
let lastY = 0
let teardown: (() => void) | null = null

const refreshBounds = (): void => {
  maxScroll = readMaxScroll()
}

const install = (): void => {
  const tick = coalesceToFrame((): void => {
    const y = clampScroll(window.scrollY, maxScroll)
    const delta = y - lastY
    lastY = y
    // Snapshot: a callback destroying another subscription must not disturb this fan-out.
    for (const subscriber of [...subscribers]) {
      subscriber.onTick(y, delta)
    }
  })
  const onScroll = (): void => {
    tick.schedule()
  }
  const onGrowthSettled = debounce(refreshBounds, SETTLE_DEBOUNCE_MS)
  const onResizeSettled = debounce((): void => {
    refreshBounds()
    for (const subscriber of [...subscribers]) {
      subscriber.onSettledResize?.()
    }
  }, SETTLE_DEBOUNCE_MS)

  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onResizeSettled, { passive: true })
  let documentObserver: ResizeObserver | null = null
  if (typeof ResizeObserver === 'function') {
    documentObserver = new ResizeObserver(onGrowthSettled)
    documentObserver.observe(document.documentElement)
  }

  teardown = (): void => {
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', onResizeSettled)
    documentObserver?.disconnect()
    tick.cancel()
    onGrowthSettled.cancel()
    onResizeSettled.cancel()
    teardown = null
  }
}

export function subscribeScroll(subscriber: IScrollSubscriber): {
  /** Current clamped scroll position, read fresh (does not disturb the tick baseline). */
  readY(): number
  refreshBounds(): void
  destroy(): void
} {
  refreshBounds()
  if (!subscribers.size) {
    // Seed before the listeners so the first real delta reflects true direction, and so a
    // synchronous boot-time readY() is already correct.
    lastY = clampScroll(window.scrollY, maxScroll)
    install()
  }
  subscribers.add(subscriber)

  return {
    readY: () => clampScroll(window.scrollY, maxScroll),
    refreshBounds,
    destroy() {
      // delete() gates the refcount: a second destroy of the same subscription must not tear
      // the bus down under the remaining subscribers.
      if (!subscribers.delete(subscriber)) {
        return
      }
      if (!subscribers.size) {
        teardown?.()
      }
    }
  }
}
