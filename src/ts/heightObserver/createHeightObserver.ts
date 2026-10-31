import { EXTENT_ATTR, SETTLE_DEBOUNCE_MS } from '../constants'
import type { IHeightObserver, IHeightObserverArgs } from '../interfaces'
import { measureClearance } from '../sticky/measure'
import { debounce, Resize, readTransitionDurationMs, removeInlineVar, setInlineVar } from '../utils'

const setPxVar = (el: HTMLElement, name: string, px: number): void => {
  setInlineVar(el, name, `${px}px`)
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
 * Publishes the bar's heights as CSS custom properties on `<html>`: the settled STICKY height (the
 * bar as it rests while stuck), the settled NON-STICKY (rest) height, and the rest CLEARANCE: how
 * far the bar's content reaches from its top, counting visible `[data-arts-header-extent]`
 * descendants the bar's box does not contain (a dropdown list hanging out of a height-locked row),
 * so a template can clear what the header paints rather than what it measures. Each value is
 * captured once the bar has settled in the matching state (a border-box ResizeObserver and the
 * sticky flips arm the capture), so mid-transition frames never corrupt the stable values; the rest
 * pair is also seeded from the pre-paint inline CSS vars, so a scroll-restored load that boots
 * already-sticky keeps the correct rest height.
 *
 * There is no live value on purpose: an inherited var on `<html>` re-resolves every `var()` user
 * on the page (a whole-document style recalc per change, measured at 85–130 ms on a 2,700-element
 * page at 4x CPU), so the engine publishes only state endpoints, which change when the layout
 * really does, and a consumer picks the one for the current state through the wrapper's state
 * class. Every write is skipped when the value is unchanged, so the pre-paint seed's re-run at an
 * AJAX header swap and a re-init on an unchanged header cost nothing.
 */
export function createHeightObserver(args: IHeightObserverArgs): IHeightObserver {
  const { bar, options, config, isSticking, initialHeight } = args
  const root = document.documentElement
  const varSticky = config.vars.headerHeightSticky
  const varNonSticky = config.vars.headerHeightNonSticky
  const varClearance = config.vars.clearanceNonSticky
  const heightClass = config.classes.hasHeaderHeight

  let heightSticky = 0
  let heightNonSticky = readSeededRestVar(varNonSticky)
  let clearanceNonSticky = readSeededRestVar(varClearance)
  let resize: Resize | null = null
  let destroyed = false
  let suppressed = false
  let transitionTimer = 0

  const publishSticky = (): void => {
    if (heightSticky > 0) {
      setPxVar(root, varSticky, heightSticky)
    }
  }

  const publishRest = (): void => {
    // Never write a 0 non-sticky height — it means no genuine non-sticky state was measured yet,
    // and 0 would stomp the correct pre-paint value.
    if (heightNonSticky > 0) {
      setPxVar(root, varNonSticky, heightNonSticky)
    }
    if (clearanceNonSticky > 0) {
      setPxVar(root, varClearance, clearanceNonSticky)
    }
  }

  // Armed only by genuine var changes, so the signal always follows the writes it reports.
  const notifyVarsSettled = debounce((): void => {
    args.onHeightVarsSettled?.()
  }, SETTLE_DEBOUNCE_MS)

  const setSticky = (value: number): void => {
    if (value !== heightSticky) {
      heightSticky = value
      publishSticky()
      notifyVarsSettled()
    }
  }

  // One write and one settle signal for the pair, whichever of the two moved.
  const setRest = (value: number, clearance: number): void => {
    if (value !== heightNonSticky || clearance !== clearanceNonSticky) {
      heightNonSticky = value
      clearanceNonSticky = clearance
      publishRest()
      notifyVarsSettled()
    }
  }

  // A shrink/grow transition fires the RO on many frames; capturing only after it settles avoids
  // stomping the stable values with mid-transition frames (and with a frame where the state already
  // flipped but the bar is still animating). One rect read serves whichever state the bar settled
  // in; the clearance rides the same read.
  const measureSettled = debounce((): void => {
    const rect = bar.getBoundingClientRect()
    if (isSticking()) {
      setSticky(Math.round(rect.height))
    } else {
      setRest(Math.round(rect.height), varClearance.length ? measureClearance(bar, rect) : 0)
    }
  }, SETTLE_DEBOUNCE_MS)

  // Every change arms the settled capture. A caller-measured height while stuck publishes the
  // sticky value at once (the composition root's boot pass and `refresh()` measured before their
  // own writes, so no read is added); the rest pair always waits for the settle.
  const updateValue = (height?: number): void => {
    if (destroyed) {
      return
    }
    measureSettled()
    if (height !== undefined && isSticking()) {
      setSticky(height)
    }
  }

  updateValue(initialHeight)
  // Re-asserts the seeded rest pair; a no-op when the pre-paint seed already wrote it.
  publishRest()
  if (options.observe) {
    // The marked descendants resize without the bar doing so (a list taller than its locked row),
    // so they are observed too: any delivery re-arms the settled capture, which reads both.
    const extents = varClearance.length
      ? Array.from(bar.querySelectorAll<HTMLElement>(`[${EXTENT_ATTR}]`))
      : []
    resize = new Resize({
      elements: [bar, ...extents],
      callbackResize: () => {
        // Endpoint publishing: the bar's own state transition resizes it every frame — the flip's
        // scheduled settle write publishes instead.
        if (suppressed) {
          return
        }
        // Next frame, never inside this delivery: a consumer turning a var into page height
        // resizes `<html>`, which the scroll bus (and Lenis) observe — a shallower target resized
        // mid-delivery is skipped and the browser reports the RO loop error.
        requestAnimationFrame(() => updateValue())
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
      // RO-driven captures for the transition and publish once, settled. Explicit update() stays
      // immediate — the scheduled endpoint write corrects a rare mid-window measure pass.
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
      measureSettled.cancel()
      notifyVarsSettled.cancel()
      if (revert && options.cleanupOnDestroy) {
        removeInlineVar(root, varSticky)
        removeInlineVar(root, varNonSticky)
        removeInlineVar(root, varClearance)
        toggleRootClass(heightClass, false)
      }
    }
  }
}
