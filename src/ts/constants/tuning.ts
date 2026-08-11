/** Numeric knobs shared across the engine — named so call sites explain themselves. */

/**
 * Slack (px) the deferred-publish check allows between the scrub accumulator and the scroll
 * travelled since the stick crossing before treating the bar as visibly held in place. Absorbs
 * sub-pixel rounding between the IntersectionObserver overshoot and the scroll sampling.
 */
export const PENDING_STICK_TOLERANCE_PX = 4

/**
 * Trailing debounce for "settled" captures: the non-sticky height measurement after a bar
 * transition, and the scroll tracker's resize-driven bounds refresh.
 */
export const SETTLE_DEBOUNCE_MS = 150
