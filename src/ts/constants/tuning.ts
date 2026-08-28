/** Numeric knobs shared across the engine — named so call sites explain themselves. */

/**
 * Trailing debounce for every "settled" capture: the sticky engine's re-measure pass, the scroll
 * bus's bounds refresh and its settled-resize fan-out, the non-sticky height measurement after a
 * bar transition, and the height-vars-settled signal.
 */
export const SETTLE_DEBOUNCE_MS = 150
