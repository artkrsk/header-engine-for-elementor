import type { IStateFlag } from '../interfaces'
import { shouldPublishDeferredStick } from './deferredPublish'
import { nextScrubOffset, scrubTransform, shouldOwnTransformViaCSS } from './revealScrub'

/**
 * The scrub-mode state cluster: the clamped offset accumulator, the per-frame inline transform
 * writes, the JS↔CSS transform ownership swap, and the deferred stick-publish bookkeeping.
 * Created by createSticky only when reveal mode is `scrub`; reports back through callbacks so the
 * publish order (class → side effects → event) stays in the orchestrator.
 */
export function createScrubState(args: {
  container: HTMLElement
  revealScrub: IStateFlag
  isLocked: () => boolean
  isHidden: () => boolean
  getBarHeight: () => number
  onDirection: (scrollingDown: boolean, revealing: boolean) => void
  onDisplaced: (displaced: boolean) => void
  onPublishStick: () => void
}) {
  let offset = 0
  let pendingPublish = false
  let departureAnchorY = 0

  const apply = (): void => {
    args.container.style.transform = scrubTransform(offset)
  }

  /** Publish once the deferred bar either fully departed (swap happens off-screen) or visibly pins. */
  const resolvePending = (y: number): void => {
    if (
      pendingPublish &&
      shouldPublishDeferredStick(offset, args.getBarHeight(), y - departureAnchorY)
    ) {
      pendingPublish = false
      args.onPublishStick()
    }
  }

  /**
   * JS owns the wrapper transform only while actively scrubbing; locked and hidden both gate the
   * frame writes, so in those states ownership passes to CSS — dropping the scrub class re-enables
   * the mode transition and clearing the inline transform lets the state rules animate the change.
   * Reclaiming restores the parked offset, visually identical to what CSS was showing, so the swap
   * is seamless.
   */
  const syncOwnership = (): void => {
    if (shouldOwnTransformViaCSS(args.isLocked(), args.isHidden())) {
      args.revealScrub.set(false)
      args.container.style.removeProperty('transform')
    } else {
      args.revealScrub.set(true)
      apply()
    }
  }

  return {
    /** Marks the wrapper so CSS drops its transform transition (per-frame writes own it). */
    enable(): void {
      args.revealScrub.set(true)
    },
    /** The per-tick scrub step; `minY` gates the hide by the configured reveal offset. */
    update(delta: number, y: number, minY: number): void {
      resolvePending(y)
      if (args.isHidden()) {
        // A hide-over zone forces fully hidden; frozen until it clears.
        return
      }
      if (delta > 0 && y <= minY) {
        // The hide is offset-gated; reveal (delta < 0) always runs.
        return
      }
      const next = nextScrubOffset(offset, delta, args.getBarHeight())
      if (next === offset) {
        return
      }
      offset = next
      apply()
      resolvePending(y)
      // Keep the direction classes live for consumer styling (transform is JS-owned in scrub).
      args.onDirection(delta > 0, delta < 0)
      if (offset >= args.getBarHeight()) {
        args.onDisplaced(true)
      } else if (offset <= 0) {
        args.onDisplaced(false)
      }
    },
    /** Start deferring the stick publish through a natural departure, anchored at the crossing Y. */
    beginDeferral(y: number): void {
      pendingPublish = true
      departureAnchorY = y
    },
    /** Drop an unresolved deferral; reports whether one was actually pending. */
    cancelDeferral(): boolean {
      const wasPending = pendingPublish
      pendingPublish = false
      return wasPending
    },
    /** Reset the accumulator so each stick cycle starts fully shown. */
    resetShown(): void {
      offset = 0
      apply()
    },
    /** Hidden parks the offset at full-hide (a later scroll-up reveals); leaving hidden while
     * locked parks it at shown (CSS shows the bar). Both are bookkeeping for the eventual reclaim. */
    handleHiddenChange(hidden: boolean): void {
      if (hidden) {
        offset = args.getBarHeight()
      } else if (args.isLocked()) {
        offset = 0
      }
      syncOwnership()
    },
    handleLockedChange(locked: boolean): void {
      if (locked && !args.isHidden()) {
        // Lock reveals: park the offset at shown so a later unlock reclaims from there.
        offset = 0
      }
      syncOwnership()
    }
  }
}
