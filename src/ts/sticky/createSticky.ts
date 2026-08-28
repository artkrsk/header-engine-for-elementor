import { EVENTS, SETTLE_DEBOUNCE_MS } from '../constants'
import { dispatchHeaderEvent } from '../events/headerEvents'
import type { ISticky, IStickyArgs } from '../interfaces'
import type { THeaderEventName } from '../types'
import { debounce } from '../utils'
import {
  estimateNaturalTop,
  measureBar,
  measureNaturalTop,
  measurePinLine,
  measureRevealOffset,
  registerRevealOffsetProperty
} from './measure'
import { resolvePinned } from './pinned'
import { createRelease } from './release'
import { resolveElementRef } from './resolveElement'
import { decideAutoHide } from './revealAutoHide'
import { createStateFlag } from './stateFlag'
import { subscribeScroll } from './subscribeScroll'
import { applyToggleAttributes } from './toggleAttributes'
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
 * The sticky orchestrator: owns the cached geometry (bar height, pin line, natural position,
 * reveal offset, viewport height), evaluates the pure deciders on every scroll tick, and
 * publishes class → side effects → event, so consumers reading the DOM inside an event listener
 * see the settled state. All visible animation is CSS-owned — the engine only toggles classes;
 * nothing is ever injected into the DOM, and no IntersectionObservers exist (measure passes +
 * the tick carry everything).
 */
export function createSticky(args: IStickyArgs): ISticky {
  const { container, bar, options, config } = args
  const revealEnabled = options.reveal
  const trigger = resolveElementRef(options.trigger, 'trigger')

  if (revealEnabled) {
    registerRevealOffsetProperty(config.vars.revealOffset)
  }

  let barHeight = measureBar(bar)
  // The pin line derives from the wrapper's COMPUTED positioning (custom pin offsets, the
  // bottom-pinned flow variant, negative compact offsets — all just CSS the engine reads back).
  let pin = measurePinLine(container)
  // The engagement offset reads from a CSS var (responsive px / vh / header height are all just
  // values of it); re-measured on every update() pass.
  let revealOffset = revealEnabled ? measureRevealOffset(container, config.vars.revealOffset) : 0
  let viewportH = window.innerHeight
  // The wrapper's slot position: exact when measurable (trigger, unpinned flow), slot-anchored
  // estimate otherwise (boot while pinned, out-of-flow modes) — corrected by later measures.
  let naturalTop = measureNaturalTop(container, trigger, pin) ?? estimateNaturalTop(container)
  // The bar's rest height — frozen while stuck. Published as the wrapper's natural-height var so
  // the flow slot stays constant when sticky styling resizes the bar; also the pinned element's
  // height for the bottom-edge decider (the slot IS the wrapper's height once the var is live).
  let restHeight = barHeight

  /** The top-line scroll anchor consumed by auto-hide, until, and zones — 0 for a bottom pin. */
  const topLine = (): number => (pin.edge === 'top' ? pin.offset : 0)

  // Geometric pinned state, published as `sticking` immediately.
  let stuck = false
  let displaced = false
  let destroyed = false

  const sticking = createStateFlag(container, config.classes.sticking)
  const revealing = createStateFlag(container, config.classes.revealing)
  const scrollingDown = createStateFlag(container, config.classes.scrollingDown)
  const hidden = createStateFlag(container, config.classes.hidden)
  const locked = createStateFlag(container, config.classes.locked)
  const released = createStateFlag(container, config.classes.released)

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

  const setSticking = (value: boolean): void => {
    if (!sticking.set(value)) {
      return
    }
    applyToggleAttributes(container, options.toggleAttributes, value)
    args.onStickingChange?.(value)
    notify(EVENTS.STICKY, value)
    if (value && !revealEnabled) {
      // Simple sticky: displaced immediately on stick.
      setDisplaced(true)
    } else if (!value) {
      scrollingDown.set(false)
      revealing.set(false)
      setDisplaced(false)
    }
  }

  const updateAutoHide = (delta: number, y: number): void => {
    const decision = decideAutoHide(delta, y, topLine(), revealOffset)
    if (!decision) {
      return
    }
    scrollingDown.set(decision.scrollingDown)
    revealing.set(decision.revealing)
    setDisplaced(decision.scrollingDown)
  }

  const release = createRelease({
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

  // Zones opt out per instance: a secondary header on a multi-header page must not react to
  // zone attributes meant for the primary.
  const zoneTracker = options.zones
    ? createZoneTracker({
        getPinLine: () => topLine(),
        getBarHeight: () => barHeight,
        getViewportH: () => viewportH,
        onChange: (anyHide, anyLock) => {
          setHidden(anyHide)
          setLocked(anyLock)
        }
      })
    : null

  function setHidden(value: boolean): void {
    if (hidden.set(value)) {
      notify(EVENTS.HIDDEN, value)
    }
  }

  function setLocked(value: boolean): void {
    if (!locked.set(value)) {
      return
    }
    if (value) {
      // Lock reveals the bar (the hide rule exempts `_locked`), but the tick gate freezes the
      // direction state — a frozen `_scrolling-down` would keep the sticky style scope
      // (`:not(_scrolling-down)`) from applying to a visibly shown bar. Clear it, mirroring the
      // un-pin reset.
      scrollingDown.set(false)
      revealing.set(false)
      setDisplaced(false)
    }
    notify(EVENTS.LOCKED, value)
  }

  /** State evaluation against the cached geometry — tick, measure passes, and boot all funnel here. */
  const evaluate = (y: number): void => {
    if (destroyed) {
      return
    }
    // With the slot var opted out the wrapper genuinely shrinks with the bar, so the live bar
    // height is the pinned height again.
    const pinnedHeight = config.vars.naturalHeight.length ? restHeight : barHeight
    stuck = resolvePinned(pin, naturalTop, pinnedHeight, y, viewportH)
    setSticking(stuck)
    zoneTracker?.evaluate(y)
    release.evaluate(y)
  }

  // Measure-pass only — NEVER called from the tick (the tick does arithmetic, no DOM writes).
  // Deliberately not gated by `revealEnabled`: the slot exists whenever the engine does. While
  // stuck the rest height is unmeasurable, so the last genuine rest value stands.
  const syncNaturalHeight = (): void => {
    if (destroyed || !config.vars.naturalHeight.length || stuck) {
      return
    }
    restHeight = barHeight
    container.style.setProperty(config.vars.naturalHeight, `${restHeight}px`)
  }

  // The shared page-level scroll bus: one listener + rAF tick + bounds cache for every instance.
  // A settled window resize re-runs the full measure pass — the bus already debounced it, so
  // update() rides directly (vh reveal offsets and the admin-bar line shift with the viewport).
  const tracker = subscribeScroll({
    onTick: (y, delta) => {
      evaluate(y)
      if (!shouldProcessTick({ locked: locked.value, stuck, released: released.value, delta })) {
        return
      }
      if (revealEnabled) {
        updateAutoHide(delta, y)
      }
    },
    onSettledResize: update
  })

  function update(): void {
    if (destroyed) {
      return
    }
    barHeight = measureBar(bar)
    pin = measurePinLine(container)
    revealOffset = revealEnabled ? measureRevealOffset(container, config.vars.revealOffset) : 0
    viewportH = window.innerHeight
    naturalTop = measureNaturalTop(container, trigger, pin) ?? naturalTop
    release.measure(topLine(), barHeight)
    // Bounds BEFORE the zone refresh: a zone flip toggles classes (a write), and the scrollHeight
    // read must not land after it — the pass stays a single layout flush.
    tracker.refreshBounds()
    zoneTracker?.refresh(tracker.readY())
    evaluate(tracker.readY())
    syncNaturalHeight()
  }

  const scheduleUpdate = debounce(update, SETTLE_DEBOUNCE_MS)

  // The boot-time measures can be wrong or go stale: consumer component styles injected after
  // this bundle runs resize the bar without any window resize — a settled bar resize re-runs the
  // full measurement pass (the window-resize trigger rides the bus's settled signal above).
  let barObserver: ResizeObserver | null = null
  if (typeof ResizeObserver === 'function') {
    barObserver = new ResizeObserver(scheduleUpdate)
    barObserver.observe(bar)
  }

  // A pin/reveal offset chained to the published height vars (the Header Height presets) still
  // re-resolves without any observer here: the vars' one writer signals settled changes, and the
  // composition root / app layer route that back into update() — including the cross-instance
  // case (a secondary chained to the primary's vars) on multi-header pages.

  // Boot state, evaluated synchronously — a scroll-restored load that boots pinned publishes now.
  release.measure(topLine(), barHeight)
  evaluate(tracker.readY())
  syncNaturalHeight()

  return {
    update,
    refreshZones() {
      zoneTracker?.refresh()
    },
    setHidden,
    setLocked,
    destroy(revert) {
      if (destroyed) {
        return
      }
      destroyed = true

      tracker.destroy()
      release.destroy()
      zoneTracker?.destroy()
      barObserver?.disconnect()
      scheduleUpdate.cancel()

      stuck = false

      if (revert) {
        // The slot var goes only with a full revert: on destroy(false) the wrapper must keep its
        // reserved height or the page jumps mid-AJAX — the next boot's un-stuck measure rewrites it.
        if (config.vars.naturalHeight.length) {
          container.style.removeProperty(config.vars.naturalHeight)
        }
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
        // header) — forget the values without touching the classes. `released` is the exception:
        // release.destroy() drops the release-anchor var in both paths, so the class has to go
        // with it or the header stays positioned against an anchor that no longer resolves.
        sticking.reset()
        revealing.reset()
        scrollingDown.reset()
        hidden.reset()
        locked.reset()
        released.set(false)
      }
      displaced = false
    },
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
