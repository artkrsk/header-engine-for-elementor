import type { IResolvedConfig } from './IResolvedConfig'
import type { IResolvedStickyOptions } from './IResolvedStickyOptions'

/** Everything the sticky engine needs at construction — DOM refs plus its resolved options/config. */
export interface IStickyArgs {
  container: HTMLElement
  bar: HTMLElement
  options: IResolvedStickyOptions
  config: IResolvedConfig
  /**
   * Internal wiring: fires on every genuine published sticky transition, and while sticking when
   * the held look flips, since the bar animates then too (composition root only).
   */
  onStickingChange?: (isSticking: boolean) => void
}
