/**
 * Scroll clamping against cached document bounds. `readMaxScroll` forces layout, so it runs at
 * construction / refresh / settled resize — never inside the per-frame scroll tick, which only ever
 * sees the cached value.
 */

/** Layout-forcing read of the maximum scrollable Y. */
export const readMaxScroll = (): number =>
  Math.max(0, document.documentElement.scrollHeight - window.innerHeight)

/** Clamp a scroll position into [0, maxScroll] — ignores rubber-band overscroll on both ends. */
export const clampScroll = (y: number, maxScroll: number): number =>
  Math.max(0, Math.min(y, maxScroll))
