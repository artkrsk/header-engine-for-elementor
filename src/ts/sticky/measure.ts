/** Layout-forcing metric reads — called at construction and refresh, never inside a frame. */

/** The bar's rendered border-box height, rounded to whole pixels. */
export const measureBar = (bar: HTMLElement): number =>
  Math.round(bar.getBoundingClientRect().height)

/**
 * The pin line (viewport Y where the header locks): the WP admin-bar offset, which WordPress
 * applies as `<html>` margin-top. Read as that resolved px value rather than the container's
 * computed `top` — a bottom-docked wrapper (hero-bottom at rest) reports its docked offset, not the
 * pin line.
 */
export const measureStickyTop = (): number => {
  const adminOffset = parseFloat(getComputedStyle(document.documentElement).marginTop)
  return Number.isFinite(adminOffset) ? Math.max(0, adminOffset) : 0
}
