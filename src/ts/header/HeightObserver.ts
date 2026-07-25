import { debounce, Resize } from '../utils'
import { Plugin } from './Plugin'

export class HeightObserver extends Plugin {
  private resize: Resize | null = null
  private heightValue = 0
  private heightValueNonSticky = 0

  protected override onInit(): void {
    // Seed the non-sticky height from the pre-paint inline script's CSS var so a scroll-restored
    // load (header already sticky when JS boots) doesn't stomp it to 0.
    this.seedNonStickyFromCSSVar()
    this.updateValue()
    this.updateCSSVars()
    this.updateResize()
    this.toggleHeightClass(true)
  }

  private seedNonStickyFromCSSVar(): void {
    const CSSVarNonSticky = this.config.vars.headerHeightNonSticky
    if (!CSSVarNonSticky.length) {
      return
    }
    const raw = getComputedStyle(document.documentElement).getPropertyValue(CSSVarNonSticky)
    const parsed = parseFloat(raw)
    if (Number.isFinite(parsed) && parsed > 0) {
      this.heightValueNonSticky = parsed
    }
  }

  protected override onDestroy(revert: boolean): void {
    if (this.resize) {
      this.resize.destroy()
    }

    if (revert && this.options.heightObserver.cleanupOnDestroy) {
      this.updateCSSVars(false)
      this.toggleHeightClass(false)
    }
  }

  /** Re-measure after the sticky transition settles — wired by `Header` to `Sticky.onStickyChange`. */
  public handleStickyChange(isSticking: boolean): void {
    if (isSticking) {
      return
    }

    const transitionDuration = this.getTransitionDuration()

    if (transitionDuration > 0) {
      const debouncedUpdate = debounce(() => {
        this.updateValue()
      }, transitionDuration)

      debouncedUpdate()
    } else {
      this.updateValue()
    }
  }

  private toggleHeightClass(toggle: boolean): void {
    const hasHeaderHeight = this.config.classes.hasHeaderHeight

    if (!hasHeaderHeight.length) {
      return
    }

    document.documentElement.classList.toggle(hasHeaderHeight, toggle)
  }

  private get height(): number {
    return this.heightValue
  }

  private set height(newValue: number) {
    const previousValue = this.height

    this.heightValue = newValue

    if (previousValue !== newValue) {
      this.updateCSSVars()
    }
  }

  private get heightNonSticky(): number {
    return this.heightValueNonSticky
  }

  private set heightNonSticky(newValue: number) {
    const previousValue = this.heightNonSticky

    this.heightValueNonSticky = newValue

    if (previousValue !== newValue) {
      this.updateCSSVars()
    }
  }

  /** Check if header is in sticky state by reading CSS class */
  private isSticky(): boolean {
    const stickingClass = this.config.classes.sticking

    if (!stickingClass.length) {
      return false
    }

    return this.container.classList.contains(stickingClass)
  }

  // Debounced: a shrink/grow transition fires the RO on many frames; capturing the non-sticky
  // height only after it settles avoids stomping the stable value with mid-transition frames (and
  // with a frame where the class was already removed but the bar is still animating).
  private measureNonStickySettled = debounce((): void => {
    if (!this.isSticky()) {
      this.heightNonSticky = this.bar.getBoundingClientRect().height
    }
  }, 150)

  private updateValue(): void {
    // Current height tracks live — the border-box RO fires on the padding-driven sticky shrink too.
    this.height = this.bar.getBoundingClientRect().height
    // Non-sticky (rest) height is captured separately, once settled, so transitions don't corrupt it.
    this.measureNonStickySettled()
  }

  /** Read transition-duration from element's computed styles */
  private getTransitionDuration(): number {
    const computedStyle = window.getComputedStyle(this.bar)
    const duration = computedStyle.transitionDuration

    if (!duration || duration === '0s') {
      return 0
    }

    const seconds = parseFloat(duration)
    const milliseconds = duration.includes('ms') ? seconds : seconds * 1000

    return milliseconds
  }

  private updateResize(): void {
    if (this.resize) {
      this.resize.destroy()
    }

    if (!this.options.heightObserver.observe) {
      return
    }

    this.resize = new Resize({
      elements: [this.bar],
      callbackResize: this.updateValue.bind(this)
    })
  }

  private updateCSSVars(setProperty: boolean = true): void {
    const CSSVarCurrent = this.config.vars.headerHeight
    const CSSVarNonSticky = this.config.vars.headerHeightNonSticky
    const documentElement = document.documentElement

    if (CSSVarCurrent.length) {
      if (setProperty) {
        documentElement.style.setProperty(CSSVarCurrent, `${this.height}px`)
      } else {
        documentElement.style.removeProperty(CSSVarCurrent)
      }
    }

    // Guard: never write a 0 non-sticky height — it means we haven't measured a genuine
    // non-sticky state yet, and writing 0 would stomp the correct pre-paint value.
    if (CSSVarNonSticky.length) {
      if (setProperty) {
        if (this.heightNonSticky > 0) {
          documentElement.style.setProperty(CSSVarNonSticky, `${this.heightNonSticky}px`)
        }
      } else {
        documentElement.style.removeProperty(CSSVarNonSticky)
      }
    }
  }
}
