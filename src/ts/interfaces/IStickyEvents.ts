/** Internal signals the sticky engine emits for the composition root to wire. */
export interface IStickyEvents {
  /** Published sticky state changed (fires on the same edge as the public STICKY event). */
  change: (isSticking: boolean) => void
}
