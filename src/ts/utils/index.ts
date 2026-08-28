/**
 * Self-contained helpers, inlined so the standalone plugin ships with zero runtime dependencies.
 * Mostly a vendored subset of `@arts/utilities`, trimmed to the surface the header engine uses
 * (`coalesceToFrame` and `readTransitionDurationMs` are original to this plugin).
 */
export { coalesceToFrame } from './coalesceToFrame'
export { debounce } from './debounce'
export { deepmerge } from './deepmerge'
export { elementorEditorLoaded } from './elementorEditorLoaded'
export { isHTMLElement } from './isHTMLElement'
export { JSONParse } from './jsonParse'
export { logger } from './logger'
export { readTransitionDurationMs } from './readTransitionDuration'
export { Resize } from './resize'
