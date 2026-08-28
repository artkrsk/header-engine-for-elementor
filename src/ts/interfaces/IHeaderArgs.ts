import type { IConfig } from './IConfig'
import type { IHeaderOptions } from './IHeaderOptions'

/** Optional behavior + wiring overrides for `createHeader`. */
export interface IHeaderArgs {
  options?: IHeaderOptions
  config?: IConfig
  /**
   * Fires once this header's published height vars settled at new values (after its own sticky
   * pass re-measured). The app layer fans this out to the page's other instances, whose chained
   * pin/reveal offsets reference the primary's vars — the reason no instance observes `<html>`.
   */
  onHeightVarsSettled?: () => void
}
