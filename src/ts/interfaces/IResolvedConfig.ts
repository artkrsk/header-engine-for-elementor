/** What the engine consumes after merging with defaults. An empty class string disables that state class. */
export interface IResolvedConfig {
  vars: {
    headerHeight: string
    headerHeightNonSticky: string
  }
  classes: {
    hasHeaderHeight: string
    sticking: string
    revealing: string
    scrollingDown: string
    hidden: string
    locked: string
    revealScrub: string
  }
  selectors: {
    container: string
    bar: string
  }
}
