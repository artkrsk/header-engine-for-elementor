import type { IConfig } from './IConfig'
import type { IHeaderOptions } from './IHeaderOptions'

/** Optional behavior + wiring overrides for `createHeader`. */
export interface IHeaderArgs {
  options?: IHeaderOptions
  config?: IConfig
}
