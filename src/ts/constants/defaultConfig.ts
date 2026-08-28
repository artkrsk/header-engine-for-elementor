import type { IResolvedConfig } from '../interfaces/IResolvedConfig'

/**
 * These string values are mirrored as literals in `src/styles/*` — there is no shared source of
 * truth across the two languages. `tests/ts/styleSync.test.ts` is the mechanical guard on the sync;
 * rename here and the guard fails until the styles follow.
 */
export const defaultConfig: IResolvedConfig = {
  vars: {
    headerHeight: '--arts-header-height',
    headerHeightNonSticky: '--arts-header-height-non-sticky',
    naturalHeight: '--arts-header-natural-height',
    releaseTop: '--arts-header-release-top',
    // The one engine-READ var in this config: Elementor/theme writes it, the engine resolves it
    // at measure time. (`measure.ts` also reads the SCSS-derived, non-configurable
    // `--arts-header-top-pinned`.)
    revealOffset: '--arts-header-reveal-offset'
  },
  classes: {
    hasHeaderHeight: 'has-header-height',
    sticking: 'arts-header_sticky',
    revealing: 'arts-header_revealing',
    scrollingDown: 'arts-header_scrolling-down',
    hidden: 'arts-header_hidden',
    locked: 'arts-header_locked',
    released: 'arts-header_released'
  },
  selectors: {
    container: '.js-arts-header',
    bar: '.js-arts-header__bar'
  }
}
