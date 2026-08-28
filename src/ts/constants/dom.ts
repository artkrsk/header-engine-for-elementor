/**
 * Structural class literals the engine authors itself. Mirrored by hand in `src/styles/*` — written
 * from here on the TS side so each name has exactly one home per language.
 */

/** Wrapper block + its JS query hook (the hook mirrors `defaultConfig.selectors.container`). */
export const WRAPPER_CLASS = 'arts-header'
export const WRAPPER_JS_CLASS = 'js-arts-header'

/** Bar element + hook + the mode-signaling modifier classes the editor toggles. */
export const BAR_CLASS = 'arts-header__bar'
export const BAR_JS_CLASS = 'js-arts-header__bar'
export const BAR_FIXED_CLASS = 'arts-header__bar_fixed'
export const BAR_ABSOLUTE_CLASS = 'arts-header__bar_absolute'
export const BAR_BOTTOM_CLASS = 'arts-header__bar_bottom'
export const BAR_STICKY_CLASS = 'arts-header__bar_sticky'
export const BAR_STICKY_BOTTOM_CLASS = 'arts-header__bar_sticky-bottom'

/** Editor wrapper id-class prefix: `arts-header_elementor-element-<id>`. */
export const WRAPPER_ELEMENT_ID_PREFIX = 'arts-header_elementor-element-'
