import { PENDING_STICK_TOLERANCE_PX } from '../constants'

/**
 * Scrub-mode deferred publishing: a natural departure looks like plain in-flow scrolling, so the
 * stick crossing publishes only once the bar either fully departed (a bar height of scrub travel —
 * the class/event swap happens off-screen) or is visibly held in place. "Held" shows up as the
 * accumulator lagging the scroll travelled since the crossing (revealOffset gating, a zone freeze)
 * by more than the tolerance.
 */
export const shouldPublishDeferredStick = (
  scrubOffset: number,
  barHeight: number,
  scrolledSinceStick: number,
  tolerance: number = PENDING_STICK_TOLERANCE_PX
): boolean => scrubOffset >= barHeight || scrubOffset < scrolledSinceStick - tolerance
