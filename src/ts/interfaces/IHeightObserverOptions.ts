/** Height publishing behavior. Accepted where `IHeightObserverOptions | false` unions appear. */
export interface IHeightObserverOptions {
  /** Track bar resizes live via ResizeObserver. Defaults to true. */
  observe?: boolean
  /** Remove the published CSS vars/classes on `destroy(revert)`. Defaults to false. */
  cleanupOnDestroy?: boolean
}
