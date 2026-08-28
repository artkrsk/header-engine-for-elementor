import { isHTMLElement } from './isHTMLElement'

interface IResizeArgs {
  elements: HTMLElement[]
  callbackResize?: (targets: Element[], entries: ResizeObserverEntry[]) => void
}

/**
 * Thin ResizeObserver wrapper; observes on construction, tears down on `destroy()`.
 *
 * Kept as a class (unlike the rest of the engine's factory architecture) on purpose: vendored
 * from `@arts/utilities` and trimmed to this engine's use — not this repo's own architecture to
 * redesign.
 */
export class Resize {
  private instance: ResizeObserver | null = null
  private elements: HTMLElement[]
  private callback: IResizeArgs['callbackResize'] | undefined

  constructor({ elements, callbackResize }: IResizeArgs) {
    this.elements = elements
    this.callback = callbackResize
    if (this.elements.length && this.callback) {
      this.init()
    }
  }

  public init(): void {
    if (this.instance || typeof ResizeObserver !== 'function') {
      return
    }
    this.instance = new ResizeObserver((entries) => {
      this.callback?.(
        entries.map((e) => e.target),
        entries
      )
    })
    for (const element of this.elements) {
      if (isHTMLElement(element)) {
        // Observe the border-box so padding-driven size changes (e.g. a sticky header shrinking its
        // vertical padding on scroll) fire the callback — the content-box default would miss them.
        this.instance.observe(element, { box: 'border-box' })
      }
    }
  }

  public destroy(): void {
    this.instance?.disconnect()
    this.instance = null
  }
}
