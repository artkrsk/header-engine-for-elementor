import type { IResolvedHeightObserverOptions } from './IResolvedHeightObserverOptions'
import type { IResolvedStickyOptions } from './IResolvedStickyOptions'

/** What the engine consumes after resolution — a section is concretely `false` or fully populated. */
export interface IResolvedHeaderOptions {
  sticky: IResolvedStickyOptions | false
  heightObserver: IResolvedHeightObserverOptions | false
}
