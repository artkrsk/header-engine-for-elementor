import type { IResolvedConfig } from './IResolvedConfig'
import type { IResolvedHeaderOptions } from './IResolvedHeaderOptions'

/** Everything a plugin needs at construction — DOM refs plus the resolved options/config. */
export interface IPluginArgs {
  container: HTMLElement
  bar: HTMLElement
  options: IResolvedHeaderOptions
  config: IResolvedConfig
}
