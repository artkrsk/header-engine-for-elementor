import type { IStickyEvents } from './IStickyEvents'

/** The sticky engine instance the composition root wires. Constructed armed — no separate init. */
export interface ISticky {
  /** Re-measure and re-arm observers after layout-affecting changes. */
  update(): void
  /** Re-scan the DOM for hide-over / lock-over zones. */
  refreshZones(): void
  /** Hide/show the whole bar (zone- or API-driven). Suppresses reveal while hidden. */
  setHidden(value: boolean): void
  /** Freeze the current sticky/reveal state (zone- or API-driven). */
  setLocked(value: boolean): void
  /** Tear down. `revert` restores mutated DOM and fires the accompanying state events. */
  destroy(revert: boolean): void
  /** Subscribe to an internal signal; returns the unsubscribe. */
  on<E extends keyof IStickyEvents>(event: E, cb: IStickyEvents[E]): () => void
  readonly isSticking: boolean
  readonly isHidden: boolean
  readonly isLocked: boolean
  readonly isReleased: boolean
  readonly isDisplaced: boolean
}
