import { EVENTS } from '../constants'
import { createEmitter } from '../core/emitter'
import { dispatchHeaderEvent } from '../events/headerEvents'
import type { ISticky, IStickyArgs, IStickyEvents } from '../interfaces'
import type { THeaderEventName } from '../types'
import { shouldPublishDeferredStick } from './deferredPublish'
import { measureBar, measureStickyTop } from './measure'
import { createStateFlag } from './publish'
import { decideAutoHide } from './revealAutoHide'
import { nextScrubOffset, scrubTransform, shouldOwnTransformViaCSS } from './revealScrub'
import { createScrollTracker } from './scrollTracker'
import { createStickDetection } from './stickDetection'
import { applyToggleAttributes } from './toggleAttributes'
import { createUntilRelease } from './untilRelease'
import { createZoneTracker } from './zones'

/**
 * Direction-tick gate: a lock freezes state, there's nothing to reveal before sticking, a release
 * hands the bar to normal scroll, and sub-pixel jitter / overscroll bounce is ignored. Hidden is
 * deliberately NOT gated — `_hidden` wins visually, but the underlying state must stay live so
 * exiting a hide-over zone reveals correctly.
 */
export const shouldProcessTick = (args: {
  locked: boolean
  stuck: boolean
  released: boolean
  delta: number
}): boolean => !args.locked && args.stuck && !args.released && Math.abs(args.delta) >= 1

/**
 * The sticky orchestrator: wires detection, scroll tracking, reveal, release, and zones, owns the
 * closure state they report into, and publishes classes/events in the exact legacy order (class →
 * side effects → event). The visible animation stays CSS-owned; only scrub writes a per-frame
 * inline transform.
 */
export function createSticky(args: IStickyArgs): ISticky {
  const { container, bar, options, config } = args
  const reveal = options.reveal
  const revealEnabled = reveal !== false
  const scrubMode = reveal !== false && reveal.mode === 'scrub'
  const revealOffset = reveal === false ? 0 : reveal.offset

  const events = createEmitter<IStickyEvents>()

  let barHeight = measureBar(bar)
  let stickyTop = measureStickyTop()

  // Geometric stuck state (sentinel crossing). Usually published as `sticking` immediately —
  // except during a scrub-mode natural departure, where publishing defers.
  let stuck = false
  let pendingStickPublish = false
  let departureAnchorY = 0
  let scrubOffset = 0
  let displaced = false
  let destroyed = false

  const sticking = createStateFlag(container, config.classes.sticking)
  const revealing = createStateFlag(container, config.classes.revealing)
  const scrollingDown = createStateFlag(container, config.classes.scrollingDown)
  const hidden = createStateFlag(container, config.classes.hidden)
  const locked = createStateFlag(container, config.classes.locked)
  const released = createStateFlag(container, config.classes.released)
  const revealScrub = createStateFlag(container, config.classes.revealScrub)

  const notify = (name: THeaderEventName, value: boolean): void => {
    dispatchHeaderEvent(name, { value, header: container })
  }

  const setDisplaced = (value: boolean): void => {
    if (value === displaced) {
      return
    }
    displaced = value
    notify(EVENTS.DISPLACED, value)
  }

  const applyScrubTransform = (): void => {
    container.style.transform = scrubTransform(scrubOffset)
  }

  /**
   * Scrub-mode transform ownership. JS owns the wrapper transform only while actively scrubbing;
   * locked and hidden both gate the frame writes, so in those states ownership passes to CSS —
   * dropping the scrub class re-enables the mode transition and clearing the inline transform lets
   * the state rules animate the change. Reclaiming restores the parked offset, visually identical
   * to what CSS was showing, so the swap is seamless.
   */
  const syncScrubOwnership = (): void => {
    if (shouldOwnTransformViaCSS(locked.value, hidden.value)) {
      revealScrub.set(false)
      container.style.removeProperty('transform')
    } else {
      revealScrub.set(true)
      applyScrubTransform()
    }
  }

  const setSticking = (value: boolean): void => {
    if (!sticking.set(value)) {
      return
    }
    applyToggleAttributes(container, options.toggleAttributes, value)
    events.emit('change', value)
    notify(EVENTS.STICKY, value)
    if (value && !revealEnabled) {
      // Simple sticky: displaced immediately on stick.
      setDisplaced(true)
    } else if (!value) {
      scrollingDown.set(false)
      revealing.set(false)
      if (scrubMode) {
        // Reset the accumulator so each stick cycle starts fully shown.
        scrubOffset = 0
        applyScrubTransform()
      }
      setDisplaced(false)
    }
  }

  /** Publish once the deferred bar either fully departed (swap happens off-screen) or visibly pins. */
  const resolvePendingStick = (y: number): void => {
    if (!pendingStickPublish) {
      return
    }
    if (shouldPublishDeferredStick(scrubOffset, barHeight, y - departureAnchorY)) {
      pendingStickPublish = false
      setSticking(true)
    }
  }

  const updateAutoHide = (delta: number, y: number): void => {
    const decision = decideAutoHide(delta, y, stickyTop, revealOffset)
    if (!decision) {
      return
    }
    scrollingDown.set(decision.scrollingDown)
    revealing.set(decision.revealing)
    setDisplaced(decision.scrollingDown)
  }

  const updateScrub = (delta: number, y: number): void => {
    resolvePendingStick(y)
    if (hidden.value) {
      // A hide-over zone forces fully hidden; frozen until it clears.
      return
    }
    // Gate the hide by the configured offset; reveal (delta < 0) always runs.
    if (delta > 0 && y <= stickyTop + revealOffset) {
      return
    }
    const next = nextScrubOffset(scrubOffset, delta, barHeight)
    if (next === scrubOffset) {
      return
    }
    scrubOffset = next
    applyScrubTransform()
    resolvePendingStick(y)
    // Keep the direction classes live for consumer styling (transform is JS-owned in scrub).
    scrollingDown.set(delta > 0)
    revealing.set(delta < 0)
    if (scrubOffset >= barHeight) {
      setDisplaced(true)
    } else if (scrubOffset <= 0) {
      setDisplaced(false)
    }
  }

  const tracker = revealEnabled
    ? createScrollTracker((y, delta) => {
        if (!shouldProcessTick({ locked: locked.value, stuck, released: released.value, delta })) {
          return
        }
        if (scrubMode) {
          updateScrub(delta, y)
        } else {
          updateAutoHide(delta, y)
        }
      })
    : null

  const detection = createStickDetection({
    container,
    trigger: options.trigger,
    onStuckChange: (nextStuck, overshoot) => {
      stuck = nextStuck
      if (nextStuck) {
        // Scrub natural departure: while the pinned+translated bar tracks the exact trajectory of
        // in-flow scrolling, it is visually plain page content — defer the published state until
        // the bar fully departs or visibly pins. A crossing deeper than a bar height (scroll-
        // restored load, programmatic jump) publishes immediately.
        if (scrubMode && overshoot <= barHeight) {
          pendingStickPublish = true
          departureAnchorY = tracker?.readY() ?? 0
          return
        }
        setSticking(true)
      } else {
        if (pendingStickPublish) {
          // Unstick during a deferral that never published: clear the departure leftovers the
          // published unstick branch would normally reset.
          pendingStickPublish = false
          scrubOffset = 0
          applyScrubTransform()
          scrollingDown.set(false)
          revealing.set(false)
          setDisplaced(false)
        }
        setSticking(false)
      }
    }
  })
  detection.rearm(stickyTop)

  const untilRelease = createUntilRelease({
    container,
    until: options.until,
    releaseTopVar: config.vars.releaseTop,
    onReleaseChange: (value) => {
      // Reveal is frozen by the tick gate while released, so whatever state the bar is in simply
      // detaches and scrolls off rather than animating back at the hand-off.
      if (released.set(value)) {
        notify(EVENTS.RELEASED, value)
      }
    }
  })
  untilRelease.rearm(stickyTop, barHeight)

  if (scrubMode) {
    // Marks the wrapper so CSS drops its transform transition (per-frame writes own it).
    revealScrub.set(true)
  }

  const zoneTracker = createZoneTracker({
    getStickyTop: () => stickyTop,
    getBarHeight: () => barHeight,
    onChange: (anyHide, anyLock) => {
      setHidden(anyHide)
      setLocked(anyLock)
    }
  })

  function setHidden(value: boolean): void {
    if (!hidden.set(value)) {
      return
    }
    if (scrubMode) {
      // Bookkeeping for the eventual reclaim: hidden parks the offset at full-hide (a later
      // scroll-up reveals); leaving hidden while locked parks it at shown (CSS shows the bar).
      if (value) {
        scrubOffset = barHeight
      } else if (locked.value) {
        scrubOffset = 0
      }
      syncScrubOwnership()
    }
    notify(EVENTS.HIDDEN, value)
  }

  function setLocked(value: boolean): void {
    if (!locked.set(value)) {
      return
    }
    if (scrubMode) {
      if (value && !hidden.value) {
        // Lock reveals: park the offset at shown so a later unlock reclaims from there.
        scrubOffset = 0
      }
      syncScrubOwnership()
    }
    notify(EVENTS.LOCKED, value)
  }

  return {
    update() {
      const previousStickyTop = stickyTop
      barHeight = measureBar(bar)
      stickyTop = measureStickyTop()
      // Sentinel/observer positions are viewport-relative, so a remeasure is enough; re-arm the
      // stick observer only if the sticky line moved (admin bar toggled, etc.).
      if (stickyTop !== previousStickyTop || !detection.isArmed()) {
        detection.rearm(stickyTop)
      }
      untilRelease.rearm(stickyTop, barHeight)
      zoneTracker.refresh()
      tracker?.refreshBounds()
    },
    refreshZones() {
      zoneTracker.refresh()
    },
    setHidden,
    setLocked,
    destroy(revert) {
      if (destroyed) {
        return
      }
      destroyed = true

      tracker?.destroy()
      detection.destroy()
      untilRelease.destroy()
      zoneTracker.destroy()

      stuck = false
      pendingStickPublish = false

      if (revert) {
        setSticking(false)
        revealing.set(false)
        scrollingDown.set(false)
        setHidden(false)
        setLocked(false)
        if (released.set(false)) {
          notify(EVENTS.RELEASED, false)
        }
      } else {
        // Keep the current visual state (AJAX transitions swap the page under a persistent
        // header) — forget the values without touching the classes.
        sticking.reset()
        revealing.reset()
        scrollingDown.reset()
        hidden.reset()
        locked.reset()
        released.set(false)
      }
      displaced = false

      // Final cleanup AFTER the revert resets: setHidden/setLocked(false) re-sync scrub ownership,
      // which would otherwise re-add the scrub class + a stale inline transform on a header
      // destroyed while locked or hidden.
      container.style.removeProperty('transform')
      revealScrub.set(false)
    },
    on: events.on,
    get isSticking() {
      return sticking.value
    },
    get isHidden() {
      return hidden.value
    },
    get isLocked() {
      return locked.value
    },
    get isReleased() {
      return released.value
    },
    get isDisplaced() {
      return displaced
    }
  }
}
