import type { IResolvedConfig } from './IResolvedConfig'
import type { IResolvedHeightObserverOptions } from './IResolvedHeightObserverOptions'

/**
 * Everything the height publisher needs at construction. `isSticking` is a LIVE predicate (read at
 * the moment a settled capture fires, not captured once) so the publisher never re-derives the
 * sticky state from the DOM.
 */
export interface IHeightObserverArgs {
  bar: HTMLElement
  options: IResolvedHeightObserverOptions
  config: IResolvedConfig
  isSticking: () => boolean
}
