/**
 * Coalesce a same-tick burst of schedule() calls into one callback on the next animation frame.
 * The shared shell of the scroll tick and the zones rescan — trigger logic stays at the call site.
 */
export const coalesceToFrame = (fn: () => void): { schedule(): void; cancel(): void } => {
  let rafId = 0
  let queued = false
  return {
    schedule() {
      if (queued) {
        return
      }
      queued = true
      rafId = requestAnimationFrame(() => {
        queued = false
        fn()
      })
    },
    cancel() {
      cancelAnimationFrame(rafId)
      queued = false
    }
  }
}
