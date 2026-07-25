import type { IResolvedConfig } from '../interfaces/IResolvedConfig'

/**
 * These string values are mirrored as literals in `src/styles/*.sass`. There is no shared source
 * of truth — keep both sides in sync by hand when renaming.
 */
export const defaultConfig: IResolvedConfig = {
  vars: {
    headerHeight: '--arts-header-height',
    headerHeightNonSticky: '--arts-header-height-non-sticky'
  },
  classes: {
    hasHeaderHeight: 'has-header-height',
    sticking: 'arts-header_sticky',
    revealing: 'arts-header_revealing',
    scrollingDown: 'arts-header_scrolling-down',
    hidden: 'arts-header_hidden',
    locked: 'arts-header_locked',
    released: 'arts-header_released',
    revealScrub: 'arts-header_reveal-scrub'
  },
  selectors: {
    container: '.js-arts-header',
    bar: '.js-arts-header__bar'
  }
}
