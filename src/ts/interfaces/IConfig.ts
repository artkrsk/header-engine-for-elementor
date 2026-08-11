/** CSS variable, class, and selector hooks — what callers may pass to override defaults. */
export interface IConfig {
  vars?: {
    headerHeight?: string
    headerHeightNonSticky?: string
    releaseTop?: string
  }
  classes?: {
    hasHeaderHeight?: string
    sticking?: string
    revealing?: string
    scrollingDown?: string
    hidden?: string
    locked?: string
    released?: string
    revealScrub?: string
  }
  selectors?: {
    container?: string
    bar?: string
  }
}
