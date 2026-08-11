import type { TRevealMode } from '../types/TRevealMode'

/** Hide-on-scroll-down / reveal-on-scroll-up behavior. */
export interface IRevealOptions {
  /** Animation strategy. Defaults to `auto-hide`. */
  mode?: TRevealMode
  /** Scroll distance (px) past the stick point before the hide engages. Defaults to 0 (immediate). */
  offset?: number
}
