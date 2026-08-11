/** The public engine instance `createHeader` returns. */
export interface IHeader {
  /** Wire the engine — idempotent, and a silent no-op when container/bar were missing. */
  init(): void
  /**
   * Tear down. `revert = false` (default) keeps the current visual state — what AJAX page
   * transitions want while swapping the page under a persistent header. `revert = true` restores
   * the mutated DOM and fires the accompanying state events.
   */
  destroy(revert?: boolean): void
  /** Re-measure and re-arm observers everywhere (call after layout-affecting changes). */
  refresh(): void
  /** Hide/show the whole header (drives the same state as hide-over zones). */
  toggleHidden(hidden: boolean): void
  /** Freeze/unfreeze the sticky/reveal state (drives the same state as lock-over zones). */
  lockSticky(locked: boolean): void
  /** Re-scan the DOM for hide-over / lock-over zones. */
  refreshZones(): void
  readonly isInitialized: boolean
  readonly isSticking: boolean
  readonly isHidden: boolean
  readonly isLocked: boolean
  readonly isReleased: boolean
  readonly isDisplaced: boolean
}
