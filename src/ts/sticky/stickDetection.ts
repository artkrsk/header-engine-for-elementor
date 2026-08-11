import { resolveElementRef } from './resolveElement'
import { insertSentinelBefore } from './sentinel'

/**
 * Stick detection: a 1px sentinel (or a custom trigger element) observed against a root whose top
 * edge is shrunk to the sticky line, so the target "leaves" exactly when the header pins — at the
 * page top, under a topbar, or at a hero's bottom edge alike. The pure deciders interpret one
 * delivered entry; plain-object entries satisfy the parameter shape.
 */

/**
 * Stuck iff the target left the root ABOVE the sticky line — "still below the fold" is the other
 * way a mid-page target can be non-intersecting, and it must not read as stuck.
 */
export const resolveStuck = (
  entry: Pick<IntersectionObserverEntry, 'isIntersecting'> & {
    boundingClientRect: Pick<DOMRectReadOnly, 'top'>
  },
  stickyTop: number
): boolean => !entry.isIntersecting && entry.boundingClientRect.top <= stickyTop

/**
 * How far past the sticky line the crossing was when the entry delivered — anchors the scrub
 * natural-departure math to the stick line itself. Zero when not stuck.
 */
export const resolveOvershoot = (
  entry: Pick<IntersectionObserverEntry, 'isIntersecting'> & {
    boundingClientRect: Pick<DOMRectReadOnly, 'top'>
  },
  stickyTop: number
): number =>
  resolveStuck(entry, stickyTop) ? Math.max(0, stickyTop - entry.boundingClientRect.top) : 0

/**
 * Owns the sentinel/trigger target and its IntersectionObserver. `onStuckChange` fires only on
 * genuine transitions (the edge dedup lives here; publishing policy lives in the orchestrator).
 */
export function createStickDetection(args: {
  container: HTMLElement
  trigger: string | HTMLElement | undefined
  onStuckChange: (stuck: boolean, overshoot: number) => void
}): { rearm(stickyTop: number): void; isArmed(): boolean; destroy(): void } {
  // A custom trigger replaces the auto-sentinel entirely — don't inject one.
  const triggerEl = resolveElementRef(args.trigger, 'trigger')
  const sentinel = triggerEl ? null : insertSentinelBefore(args.container)
  const target = triggerEl ?? sentinel

  let observer: IntersectionObserver | null = null
  let stuck = false

  return {
    rearm(stickyTop) {
      observer?.disconnect()
      observer = null
      if (!target) {
        return
      }
      // Shrink the root's top edge to the sticky line so the target "leaves" exactly when the
      // header pins — anchored to the natural position (or trigger), not scrollY=0.
      const margin = Math.max(0, Math.round(stickyTop))
      observer = new IntersectionObserver(
        (entries) => {
          // Batched deliveries are chronological — only the last entry reflects current state.
          const entry = entries.at(-1)
          if (!entry) {
            return
          }
          const nextStuck = resolveStuck(entry, stickyTop)
          if (nextStuck === stuck) {
            return
          }
          stuck = nextStuck
          args.onStuckChange(nextStuck, resolveOvershoot(entry, stickyTop))
        },
        { rootMargin: `${-margin}px 0px 0px 0px`, threshold: [0] }
      )
      observer.observe(target)
    },
    isArmed: () => observer !== null,
    destroy() {
      observer?.disconnect()
      observer = null
      sentinel?.remove()
    }
  }
}
