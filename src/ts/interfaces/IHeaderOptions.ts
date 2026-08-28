import type { IHeightObserverOptions } from './IHeightObserverOptions'
import type { IStickyOptions } from './IStickyOptions'

/** Behavioral options — what callers may pass (constructor or `data-arts-header-options`). */
export interface IHeaderOptions {
  /** Sticky engine; `false` disables it entirely. */
  sticky?: IStickyOptions | false
  /** Height publishing; `false` disables it entirely. */
  heightObserver?: IHeightObserverOptions | false
}
