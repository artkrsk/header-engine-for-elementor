import { SETTLE_DEBOUNCE_MS } from '../constants'
import type { IHeightObserver, IHeightObserverArgs } from '../interfaces'
import { debounce, Resize, readTransitionDurationMs } from '../utils'

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
  let heightNonSticky = 0
  let resize: Resize | null = null
  let destroyed = false

  const updateCSSVars = (setProperty = true): void => {
    const root = document.documentElement
    if (varCurrent.length) {
      if (setProperty) {
        root.style.setProperty(varCurrent, `${height}px`)
      } else {
        root.style.removeProperty(varCurrent)
      }
    }
    if (varNonSticky.length) {
      if (setProperty) {
        // Never write a 0 non-sticky height — it means no genuine non-sticky state was measured
        // yet, and 0 would stomp the correct pre-paint value.
        if (heightNonSticky > 0) {
          root.style.setProperty(varNonSticky, `${heightNonSticky}px`)
        }
      } else {
        root.style.removeProperty(varNonSticky)
      }
    }
  }

  const toggleHeightClass = (toggle: boolean): void => {
    if (heightClass.length) {
      document.documentElement.classList.toggle(heightClass, toggle)
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

  const seedNonStickyFromCSSVar = (): void => {
    if (!varNonSticky.length) {
      return
    }
    const raw = getComputedStyle(document.documentElement).getPropertyValue(varNonSticky)
    const parsed = parseFloat(raw)
    if (Number.isFinite(parsed) && parsed > 0) {
      heightNonSticky = parsed
    }
  }

  seedNonStickyFromCSSVar()
  updateValue()
  updateCSSVars()
  if (options.observe) {
    resize = new Resize({ elements: [bar], callbackResize: updateValue })
  }
  toggleHeightClass(true)

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
        updateCSSVars(false)
        toggleHeightClass(false)
      }
    }
  }
}
