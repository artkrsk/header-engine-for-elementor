/**
 * Scrub reveal math. The clamped accumulator IS the moving window: the bar follows scroll 1:1
 * within a bar height of travel, and reversing decreases the offset immediately from the current
 * position. The DOM half writes `scrubTransform(offset)` inline each frame; ownership hands back to
 * CSS while locked or hidden so those transitions animate instead of fighting the frame writes.
 */

/** Next accumulator value for a scroll delta, clamped to [0, barHeight]. */
export const nextScrubOffset = (current: number, delta: number, barHeight: number): number =>
  Math.min(barHeight, Math.max(0, current + delta))

/** The inline wrapper transform for an accumulator value. */
export const scrubTransform = (offset: number): string => `translateY(-${offset}px)`

/**
 * While locked or hidden the frame writes are gated, so the wrapper transform belongs to CSS —
 * dropping the scrub class re-enables the mode transition and the state rules animate the change.
 */
export const shouldOwnTransformViaCSS = (locked: boolean, hidden: boolean): boolean =>
  locked || hidden
