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

  const updateCSSVars = (): void => {
    setRootVar(varCurrent, height)
    // Never write a 0 non-sticky height — it means no genuine non-sticky state was measured yet,
    // and 0 would stomp the correct pre-paint value.
    if (heightNonSticky > 0) {
      setRootVar(varNonSticky, heightNonSticky)
    }
  }

  const setHeight = (value: number): void => {
    if (value !== height) {
      height = value
      updateCSSVars()
    }
  }

  const setHeightNonSticky = (value: number): void => {
    if (value !== heightNonSticky) {
      heightNonSticky = value
      updateCSSVars()
    }
  }

  // A shrink/grow transition fires the RO on many frames; capturing the rest height only after it
  // settles avoids stomping the stable value with mid-transition frames (and with a frame where
  // the state already unpublished but the bar is still animating).
  const measureNonStickySettled = debounce((): void => {
    if (!isSticking()) {
      setHeightNonSticky(bar.getBoundingClientRect().height)
    }
  }, SETTLE_DEBOUNCE_MS)

  const updateValue = (): void => {
    setHeight(bar.getBoundingClientRect().height)
    measureNonStickySettled()
  }

  updateValue()
  updateCSSVars()
  if (options.observe) {
    resize = new Resize({ elements: [bar], callbackResize: updateValue })
  }
  toggleRootClass(heightClass, true)

  return {
    update() {
      updateValue()
    },
    handleStickyChange(sticking) {
      // Only the unstick transition matters: the bar animates back to its rest size, so the
      // re-measure waits out the bar's own transition first.
      if (sticking) {
        return
      }
      const transitionMs = readTransitionDurationMs(bar)
      if (transitionMs > 0) {
        window.setTimeout(() => updateValue(), transitionMs)
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
      if (revert && options.cleanupOnDestroy) {
        removeRootVar(varCurrent)
        removeRootVar(varNonSticky)
        toggleRootClass(heightClass, false)
      }
    }
  }
}
