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
  /**
   * Fires once either published height var genuinely changed and the writes settled (the vars are
   * already updated). Lets consumers re-resolve var chains referencing the height vars: a stale
   * pre-paint seed correcting, or a live-height change while sticky (a chained pin offset) —
   * neither of which the reader's own observers can see.
   */
  onHeightVarsSettled?: () => void
}
