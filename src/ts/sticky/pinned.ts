import type { TPinLine } from '../types/TPinLine'

/**
 * Pinned-state decider — pure math against cached geometry, evaluated on the scroll tick and at
 * measure passes. Replaces the old sentinel + IntersectionObserver detection: no injected DOM (an
 * in-flow sentinel costs a full gap slot in flex parents), no delivery latency, and no
 * dying-observer records to guard against.
 */

/** The slack the old 1px sentinel provided: pinning publishes one pixel past the line. */
export const PIN_EPSILON_PX = 1

/**
 * Top edge: pinned once the page scrolled the natural position past the pin line (plus the
 * epsilon, so a header resting exactly at its line is not yet pinned). Bottom edge: pinned while
 * the natural position still sits below the bottom slot line — `pinnedHeight` is the PINNED
 * element's (wrapper's) height, which the flow rest-height slot can hold above the live bar
 * height. A pin line beyond the viewport is degenerate — never pinned (a var-chained offset can
 * transiently resolve against an uncorrected pre-paint seed).
 */
export const resolvePinned = (
  pin: TPinLine,
  naturalTop: number,
  pinnedHeight: number,
  y: number,
  viewportH: number
): boolean => {
  if (pin.edge === 'bottom') {
    const line = viewportH - pin.offset - pinnedHeight
    if (line <= 0) {
      return false
    }
    return naturalTop - y >= line
  }
  if (pin.offset >= viewportH) {
    return false
  }
  return y >= naturalTop - pin.offset + PIN_EPSILON_PX
}
