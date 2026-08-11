import type { TToggleAttributes } from '../types/TToggleAttributes'
import type { IRevealOptions } from './IRevealOptions'

/** Sticky engine behavior. Accepted where `IStickyOptions | false` unions appear; `false` disables. */
export interface IStickyOptions {
  /** Optional element/selector whose position anchors stick detection instead of the auto sentinel. */
  trigger?: string | HTMLElement
  /** Hide/reveal on scroll. `false` disables; omitted = auto-hide with zero offset. */
  reveal?: IRevealOptions | false
  /** Optional boundary element/selector; the header stops sticking past it (sticky-until). */
  until?: string | HTMLElement
  /** Attributes swapped on the container when the sticky state toggles. `false` (default) disables. */
  toggleAttributes?: TToggleAttributes | false
}
