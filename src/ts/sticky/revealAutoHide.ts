/**
 * Auto-hide reveal decision for one scroll tick. Returns the direction-state pair to publish, or
 * `null` when the tick changes nothing (a downward move still inside the offset slack). The hide is
 * gated by the configured offset past the sticky line; a reveal always runs — an upward move must
 * bring the bar back no matter where it happens.
 */
export const decideAutoHide = (
  delta: number,
  y: number,
  stickyTop: number,
  offset: number
): { scrollingDown: boolean; revealing: boolean } | null => {
  if (delta > 0 && y > stickyTop + offset) {
    return { scrollingDown: true, revealing: false }
  }
  if (delta < 0) {
    return { scrollingDown: false, revealing: true }
  }
  return null
}
