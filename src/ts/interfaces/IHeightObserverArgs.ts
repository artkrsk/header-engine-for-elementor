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
   * The bar's rounded border-box height the composition root measured BEFORE any of the boot
   * pass's DOM writes. The publisher then publishes it instead of reading the rect itself, so
   * the whole boot stays one layout flush; absent, the constructor reads (the standalone path).
   */
  initialHeight?: number
  /**
   * Fires once either published height var genuinely changed and the writes settled (the vars are
   * already updated). Lets consumers re-resolve var chains referencing the height vars: a stale
   * pre-paint seed correcting, or a live-height change while sticky (a chained pin offset) —
   * neither of which the reader's own observers can see.
   */
  onHeightVarsSettled?: () => void
}
