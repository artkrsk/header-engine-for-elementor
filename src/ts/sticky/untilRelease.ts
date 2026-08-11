import { resolveElementRef } from './resolveElement'
import { insertSentinelBefore } from './sentinel'

/**
 * Sticky-until release: past the configured boundary the header stops pinning and scrolls away with
 * the page. A zero-footprint sentinel at the boundary's TOP edge gives a clean, jump-proof crossing
 * (observing the often-tall boundary itself would stay "intersecting" until it fully cleared the
 * line). This module owns the release anchor CSS var; the released class/event ride the callback.
 */

/** Released iff the boundary's top edge crossed above the release line. */
export const resolveReleased = (
  entry: Pick<IntersectionObserverEntry, 'isIntersecting'> & {
    boundingClientRect: Pick<DOMRectReadOnly, 'top'>
  },
  line: number
): boolean => !entry.isIntersecting && entry.boundingClientRect.top <= line

/**
 * The document Y the header holds at the release moment — anchoring there makes the fixed→absolute
 * swap continuous, so the bar detaches with no jump.
 */
export const releaseAnchor = (scrollY: number, stickyTop: number): number =>
  Math.round(scrollY + stickyTop)

export function createUntilRelease(args: {
  container: HTMLElement
  until: string | HTMLElement | undefined
  releaseTopVar: string
  onReleaseChange: (released: boolean) => void
}): { rearm(stickyTop: number, barHeight: number): void; destroy(): void } {
  const boundary = resolveElementRef(args.until, 'until')
  const sentinel = boundary ? insertSentinelBefore(boundary) : null

  let observer: IntersectionObserver | null = null
  let released = false
  let lastStickyTop = 0

  const applyAnchor = (value: boolean): void => {
    if (!args.releaseTopVar.length) {
      return
    }
    if (value) {
      const anchor = releaseAnchor(window.scrollY, lastStickyTop)
      args.container.style.setProperty(args.releaseTopVar, `${anchor}px`)
    } else {
      args.container.style.removeProperty(args.releaseTopVar)
    }
  }

  return {
    // Unconditional per update: the release line is pin + bar height, and the bar can resize
    // without the pin line moving.
    rearm(stickyTop, barHeight) {
      lastStickyTop = stickyTop
      observer?.disconnect()
      observer = null
      if (!sentinel) {
        return
      }
      // The release line is the header's bottom edge — the hand-off happens when edges meet.
      const line = stickyTop + barHeight
      const margin = Math.max(0, Math.round(line))
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries.at(-1)
          if (!entry) {
            return
          }
          const next = resolveReleased(entry, line)
          if (next === released) {
            return
          }
          released = next
          // Anchor var first, then the class/event via the callback — the swap must be continuous
          // by the time consumers observe the state change.
          applyAnchor(next)
          args.onReleaseChange(next)
        },
        { rootMargin: `${-margin}px 0px 0px 0px`, threshold: [0] }
      )
      observer.observe(sentinel)
    },
    destroy() {
      observer?.disconnect()
      observer = null
      sentinel?.remove()
      if (args.releaseTopVar.length) {
        args.container.style.removeProperty(args.releaseTopVar)
      }
    }
  }
}
