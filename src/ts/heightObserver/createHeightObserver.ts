import { SETTLE_DEBOUNCE_MS } from '../constants'
import type { IHeightObserver, IHeightObserverArgs } from '../interfaces'
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

/** Read the pre-paint inline non-sticky height var; 0 when absent or invalid. */
const readSeededNonStickyHeight = (varName: string): number => {
  if (!varName.length) {
    return 0
  }
  const parsed = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(varName))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

/**
 * Publishes the bar's live and rest heights as CSS custom properties on `<html>`. The live height
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
  const { bar, options, config, isSticking } = args
  const varCurrent = config.vars.headerHeight
  const varNonSticky = config.vars.headerHeightNonSticky
  const heightClass = config.classes.hasHeaderHeight

  let height = 0
  let heightNonSticky = readSeededNonStickyHeight(varNonSticky)
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

  const setHeightNonSticky = (value: number): void => {
    if (value !== heightNonSticky) {
      heightNonSticky = value
      updateCSSVars()
      notifyVarsSettled()
    }
  }

  // A shrink/grow transition fires the RO on many frames; capturing the rest height only after it
  // settles avoids stomping the stable value with mid-transition frames (and with a frame where
  // the state already unpublished but the bar is still animating).
  const measureNonStickySettled = debounce((): void => {
    if (!isSticking()) {
      setHeightNonSticky(Math.round(bar.getBoundingClientRect().height))
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
    const blockSize = entries[entries.length - 1]?.borderBoxSize?.[0]?.blockSize
    return blockSize === undefined ? null : Math.round(blockSize)
  }

  updateValue()
  updateCSSVars()
  if (options.observe) {
    resize = new Resize({
      elements: [bar],
      callbackResize: (_targets, entries) => {
        // Endpoint publishing: the bar's own state transition resizes it every frame, and each
        // root var write would style-recalc every consumer — the flip's scheduled settle write
        // publishes instead.
        if (suppressed) {
          return
        }
        updateValue(readEntryHeight(entries) ?? undefined)
      }
    })
  }
  toggleRootClass(heightClass, true)

  return {
    update() {
      updateValue()
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
        toggleRootClass(heightClass, false)
      }
    }
  }
}
