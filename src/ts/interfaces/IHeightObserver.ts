/** The height publisher the composition root wires. Constructed publishing — no separate init. */
export interface IHeightObserver {
  /**
   * Re-measure immediately (call after layout-affecting changes). `height` is a caller-measured
   * bar height taken before the caller's own writes — it skips the rect read.
   */
  update(height?: number): void
  /**
   * Wired to the sticky 'change' signal. Both edges suppress the live RO-driven publishes for
   * the bar's own transition and publish once, settled — per-frame root var writes would
   * style-recalc every consumer of the inherited height vars.
   */
  handleStickyChange(isSticking: boolean): void
  /** Tear down. `revert` + `cleanupOnDestroy` removes the published vars/class. */
  destroy(revert: boolean): void
}
