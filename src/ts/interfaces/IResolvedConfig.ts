/** What the engine consumes after merging with defaults. An empty class string disables that state class. */
export interface IResolvedConfig {
  vars: {
    headerHeightSticky: string
    headerHeightNonSticky: string
    clearanceNonSticky: string
    naturalHeight: string
    releaseTop: string
    revealOffset: string
  }
  classes: {
    hasHeaderHeight: string
    sticking: string
    revealing: string
    scrollingDown: string
    hidden: string
    locked: string
    held: string
    alt: string
    released: string
  }
  selectors: {
    container: string
    bar: string
  }
}
