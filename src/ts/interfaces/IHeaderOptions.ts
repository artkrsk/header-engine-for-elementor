import type { THeaderMode } from '../types/THeaderMode'
import type { TRevealMode } from '../types/TRevealMode'
import type { TToggleAttributes } from '../types/TToggleAttributes'

/** Behavioral options — what callers may pass (constructor or `data-arts-header-options`). */
export interface IHeaderOptions {
  /** Docking mode. Defaults to `flow` (native `position: sticky`). */
  mode?: THeaderMode

  sticky?: {
    enabled?: boolean
    /** Optional element/selector whose position anchors stick detection instead of the auto sentinel. */
    trigger?: string | HTMLElement
    /** Enable hide-on-scroll-down / reveal-on-scroll-up. */
    toggleReveal?: boolean
    /** Animation strategy for the reveal. Defaults to `auto-hide`. */
    revealMode?: TRevealMode
    /** Optional boundary element/selector; the header stops sticking past it (sticky-until). */
    until?: string | HTMLElement
    toggleAttributes?: TToggleAttributes
  }

  heightObserver?: {
    enabled?: boolean
    observe?: boolean
    cleanupOnDestroy?: boolean
  }
}
