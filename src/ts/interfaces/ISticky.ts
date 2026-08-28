/** The sticky engine instance the composition root wires. Constructed armed — no separate init. */
export interface ISticky {
  /** Re-measure the cached geometry and re-evaluate all states after layout-affecting changes. */
  update(): void
  /** Re-scan the DOM for hide-over / lock-over zones. */
  refreshZones(): void
  /**
   * Hide/show the whole bar (zone- or API-driven). The hide wins visually, but the reveal state
   * keeps running underneath — so leaving a hide-over zone lands on the correct state.
   */
  setHidden(value: boolean): void
  /** Reveal the bar and hold it shown, reveal frozen (zone- or API-driven). */
  setLocked(value: boolean): void
  /** Tear down. `revert` restores mutated DOM and fires the accompanying state events. */
  destroy(revert: boolean): void
  readonly isSticking: boolean
  readonly isHidden: boolean
  readonly isLocked: boolean
  readonly isReleased: boolean
  readonly isDisplaced: boolean
}
