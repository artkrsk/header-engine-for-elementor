import { resolveElementRef } from './resolveElement'

/**
 * Sticky-until release: past the configured boundary the header stops pinning and scrolls away
 * with the page. The boundary is in-flow consumer content, so its document position is cached at
 * measure passes and the release is pure math on the tick — no sentinel, no observer. This module
 * owns the release anchor CSS var; the released class/event ride the callback.
 */

/** Released iff the header's bottom edge (pin line + bar height) crossed the boundary's top. */
export const resolveReleased = (
  y: number,
  pinOffset: number,
  barHeight: number,
  boundaryTop: number
): boolean => y + pinOffset + barHeight >= boundaryTop

/**
 * The document Y the header holds at the release moment — anchoring there makes the fixed→absolute
 * swap continuous, so the bar detaches with no jump.
 */
export const releaseAnchor = (scrollY: number, stickyTop: number): number =>
  Math.round(scrollY + stickyTop)

/** Write the release anchor var at the release moment; clear it on re-entry. */
const applyReleaseAnchor = (
  container: HTMLElement,
  varName: string,
  released: boolean,
  stickyTop: number
): void => {
  if (!varName.length) {
    return
  }
  if (released) {
    container.style.setProperty(varName, `${releaseAnchor(window.scrollY, stickyTop)}px`)
  } else {
    container.style.removeProperty(varName)
  }
}

export function createRelease(args: {
  container: HTMLElement
  until: string | HTMLElement | undefined
  releaseTopVar: string
  onReleaseChange: (released: boolean) => void
}): {
  measure(pinOffset: number, barHeight: number): void
  evaluate(y: number): void
  destroy(): void
} {
  const boundary = resolveElementRef(args.until, 'until')

  let boundaryTop = Number.POSITIVE_INFINITY
  let pinOffset = 0
  let barHeight = 0
  let released = false

  return {
    // Unconditional per measure pass: the release line is pin + bar height, and the bar can
    // resize without the pin line moving.
    measure(nextPinOffset, nextBarHeight) {
      pinOffset = nextPinOffset
      barHeight = nextBarHeight
      if (boundary) {
        boundaryTop = Math.round(boundary.getBoundingClientRect().top + window.scrollY)
      }
    },
    evaluate(y) {
      if (!boundary) {
        return
      }
      const next = resolveReleased(y, pinOffset, barHeight, boundaryTop)
      if (next === released) {
        return
      }
      released = next
      // Anchor var first, then the class/event via the callback — the swap must be continuous
      // by the time consumers observe the state change.
      applyReleaseAnchor(args.container, args.releaseTopVar, next, pinOffset)
      args.onReleaseChange(next)
    },
    destroy() {
      if (args.releaseTopVar.length) {
        args.container.style.removeProperty(args.releaseTopVar)
      }
    }
  }
}
