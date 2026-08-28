/**
 * The element's computed transition-duration in milliseconds (first value). Returns 0 for a
 * missing/zero duration and for anything unparseable — a garbage token must never leak NaN into
 * timer math.
 */
export const readTransitionDurationMs = (element: HTMLElement): number => {
  const duration = window.getComputedStyle(element).transitionDuration
  if (!duration || duration === '0s') {
    return 0
  }
  const value = parseFloat(duration)
  if (!Number.isFinite(value)) {
    return 0
  }
  return duration.includes('ms') ? value : value * 1000
}
