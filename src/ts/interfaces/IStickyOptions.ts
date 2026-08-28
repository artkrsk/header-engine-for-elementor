import type { TToggleAttributes } from '../types/TToggleAttributes'

/** Sticky engine behavior. Accepted where `IStickyOptions | false` unions appear; `false` disables. */
export interface IStickyOptions {
  /** Optional element/selector anchoring stick detection instead of the wrapper's own position. */
  trigger?: string | HTMLElement
  /**
   * Hide-on-scroll-down / reveal-on-scroll-up. Defaults to enabled. The engagement offset is not
   * an option: it reads from the `--arts-header-reveal-offset` CSS var at measure time.
   */
  reveal?: boolean
  /** Optional boundary element/selector; the header stops sticking past it (sticky-until). */
  until?: string | HTMLElement
  /**
   * React to hide-over/lock-over zone attributes. Defaults to enabled; a secondary header on a
   * multi-header page opts out so one zone doesn't hide every bar.
   */
  zones?: boolean
  /** Attributes swapped on the container when the sticky state toggles. `false` (default) disables. */
  toggleAttributes?: TToggleAttributes | false
}
