import { EXTENT_ATTR, SETTLE_DEBOUNCE_MS } from '../constants'
import type { IHeightObserver, IHeightObserverArgs } from '../interfaces'
import { measureClearance } from '../sticky/measure'
import { debounce, Resize, readTransitionDurationMs } from '../utils'

/** Set a px var on `<html>`; an empty configured name is a deliberate opt-out. */
const setRootVar = (name: string, px: number): void => {
  if (name.length) {
    document.documentElement.style.setProperty(name, `${px}px`)
  }
}

const removeRootVar = (name: string): void => {
  if (name.length) {
    document.documentElement.style.removeProperty(name)
  }
}

const toggleRootClass = (className: string, toggle: boolean): void => {
  if (className.length) {
    document.documentElement.classList.toggle(className, toggle)
  }
}

/** Read a pre-paint inline rest var (height or clearance); 0 when absent or invalid. */
const readSeededRestVar = (varName: string): number => {
  if (!varName.length) {
    return 0
  }
  const parsed = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(varName))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

/**
 * Publishes the bar's live and rest heights as CSS custom properties on `<html>`, plus the rest
 * CLEARANCE: how far the bar's content reaches from its top, counting visible
 * `[data-arts-header-extent]` descendants the bar's box does not contain (a dropdown list hanging
 * out of a height-locked row), so a template can clear what the header paints rather than what it
 * measures. Captured with the rest height, never while sticking, and seeded the same way. The live height
 * tracks a border-box ResizeObserver (the padding-driven sticky shrink fires it too); the
 * non-sticky (rest) height is captured separately once settled, so mid-transition frames never
 * corrupt the stable value, and is seeded from the pre-paint inline CSS var so a scroll-restored
 * load that boots already-sticky keeps the correct rest height.
 *
 * Publishing is ENDPOINT-ONLY across the bar's own state transition: the vars live on `<html>`
 * and inherit everywhere, so a per-frame write during the sticky shrink style-recalcs every
 * consumer on the page, every frame. A state flip suppresses the RO-driven writes for the bar's
 * measured transition duration and publishes once, settled; a consumer that visually hugs the
 * bar animates its own consuming property instead.
 */
export function createHeightObserver(args: IHeightObserverArgs): IHeightObserver {
  const { bar, options, config, isSticking, initialHeight } = args
  const varCurrent = config.vars.headerHeight
  const varNonSticky = config.vars.headerHeightNonSticky
  const varClearance = config.vars.clearanceNonSticky
  const heightClass = config.classes.hasHeaderHeight

  let height = 0
  let heightNonSticky = readSeededRestVar(varNonSticky)
  let clearanceNonSticky = readSeededRestVar(varClearance)
  let resize: Resize | null = null
  let destroyed = false
  let suppressed = false
  let transitionTimer = 0

  const updateCSSVars = (): void => {
    setRootVar(varCurrent, height)
    // Never write a 0 non-sticky height — it means no genuine non-sticky state was measured yet,
    // and 0 would stomp the correct pre-paint value.
    if (heightNonSticky > 0) {
      setRootVar(varNonSticky, heightNonSticky)
    }
    if (clearanceNonSticky > 0) {
      setRootVar(varClearance, clearanceNonSticky)
    }
  }

  // Armed only by genuine var changes, so the signal always follows the writes it reports.
  const notifyVarsSettled = debounce((): void => {
    args.onHeightVarsSettled?.()
  }, SETTLE_DEBOUNCE_MS)

  const setHeight = (value: number): void => {
    if (value !== height) {
      height = value
      updateCSSVars()
      notifyVarsSettled()
    }
  }

  // One write and one settle signal for the pair, whichever of the two moved.
  const setRest = (value: number, clearance: number): void => {
    if (value !== heightNonSticky || clearance !== clearanceNonSticky) {
      heightNonSticky = value
      clearanceNonSticky = clearance
      updateCSSVars()
      notifyVarsSettled()
    }
  }

  // A shrink/grow transition fires the RO on many frames; capturing the rest height only after it
  // settles avoids stomping the stable value with mid-transition frames (and with a frame where
  // the state already unpublished but the bar is still animating).
  const measureNonStickySettled = debounce((): void => {
    if (!isSticking()) {
      // Both reads before either write: the write would dirty the page and make the second read flush.
      const rect = bar.getBoundingClientRect()
      setRest(Math.round(rect.height), varClearance.length ? measureClearance(bar, rect) : 0)
    }
  }, SETTLE_DEBOUNCE_MS)

  const updateValue = (height?: number): void => {
    if (destroyed) {
      return
    }
    // Rest capture armed BEFORE the live write: at a shared deadline it then runs first, and its
    // own write re-arms the settle signal — one signal per settle, not one per var.
    measureNonStickySettled()
    setHeight(height ?? Math.round(bar.getBoundingClientRect().height))
  }

  // The RO delivery already carries the border-box size — no rect read on the observer path.
  // Rounded like measureBar, so sub-pixel jitter never turns into a root var write. Null when
  // the entry shape is unavailable (old engines, test fakes) — the caller reads then.
  const readEntryHeight = (entries: ResizeObserverEntry[]): number | null => {
    const blockSize = entries.find((entry) => entry.target === bar)?.borderBoxSize?.[0]?.blockSize
    return blockSize === undefined ? null : Math.round(blockSize)
  }

  updateValue(initialHeight)
  updateCSSVars()
  if (options.observe) {
    // The marked descendants resize without the bar doing so (a list taller than its locked row),
    // so they are observed too: any delivery re-arms the settled rest capture, which reads both.
    const extents = varClearance.length
      ? Array.from(bar.querySelectorAll<HTMLElement>(`[${EXTENT_ATTR}]`))
      : []
    resize = new Resize({
      elements: [bar, ...extents],
      callbackResize: (_targets, entries) => {
        // Endpoint publishing: the bar's own state transition resizes it every frame, and each
        // root var write would style-recalc every consumer — the flip's scheduled settle write
        // publishes instead.
        if (suppressed) {
          return
        }
        // Next frame, never inside this delivery: a consumer turning the var into page height
        // resizes `<html>`, which the scroll bus (and Lenis) observe — a shallower target resized
        // mid-delivery is skipped and the browser reports the RO loop error.
        const height = readEntryHeight(entries) ?? undefined
        requestAnimationFrame(() => updateValue(height))
      }
    })
  }
  toggleRootClass(heightClass, true)

  return {
    update(height) {
      updateValue(height)
    },
    handleStickyChange() {
      // Both edges animate the bar (sticky styles in, or back to rest), so both suppress the
      // RO-driven writes for the transition and publish once, settled. Explicit update() stays
      // live — the scheduled endpoint write corrects a rare mid-window measure pass.
      const transitionMs = readTransitionDurationMs(bar)
      if (transitionMs > 0) {
        suppressed = true
        window.clearTimeout(transitionTimer)
        transitionTimer = window.setTimeout(() => {
          suppressed = false
          updateValue()
        }, transitionMs)
      } else {
        updateValue()
      }
    },
    destroy(revert) {
      if (destroyed) {
        return
      }
      destroyed = true
      resize?.destroy()
      window.clearTimeout(transitionTimer)
      measureNonStickySettled.cancel()
      notifyVarsSettled.cancel()
      if (revert && options.cleanupOnDestroy) {
        removeRootVar(varCurrent)
        removeRootVar(varNonSticky)
        removeRootVar(varClearance)
        toggleRootClass(heightClass, false)
      }
    }
  }
}
