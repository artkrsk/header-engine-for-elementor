/** The height publisher the composition root wires. Constructed publishing — no separate init. */
export interface IHeightObserver {
  /** Re-measure immediately (call after layout-affecting changes). */
  update(): void
  /** Re-measure after the sticky transition settles — wired to the sticky 'change' signal. */
  handleStickyChange(isSticking: boolean): void
  /** Tear down. `revert` + `cleanupOnDestroy` removes the published vars/class. */
  destroy(revert: boolean): void
}
