/**
 * Data attributes the engine reads or the editor writes. Frozen identifiers — deliberately NOT part
 * of the configurable `IConfig` surface (that surface is for class/var/selector renames).
 */

/** Inline behavioral options JSON on the container; overrides constructor options entirely. */
export const OPTIONS_ATTR = 'data-arts-header-options'

/** Zone declarations on arbitrary page elements; the value is a `TZoneMode`. */
export const HIDE_ZONE_ATTR = 'data-arts-header-hide-over'
export const LOCK_ZONE_ATTR = 'data-arts-header-lock-over'

/**
 * Logo version tokens on the wrapper — written by the editor handler in the preview and by
 * `Markup.php` on the frontend; read by CSS only, never by JS.
 */
export const NON_STICKY_LOGO_ATTR = 'data-arts-header-non-sticky-logo'
export const STICKY_LOGO_ATTR = 'data-arts-header-sticky-logo'
