import type { IResolvedConfig } from './IResolvedConfig'
import type { IResolvedStickyOptions } from './IResolvedStickyOptions'

/** Everything the sticky engine needs at construction — DOM refs plus its resolved options/config. */
export interface IStickyArgs {
  container: HTMLElement
  bar: HTMLElement
  options: IResolvedStickyOptions
  config: IResolvedConfig
}
