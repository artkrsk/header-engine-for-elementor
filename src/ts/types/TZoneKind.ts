/**
 * What an active zone drives: `hide` fully hides the bar, `lock` reveals it and holds it shown,
 * `hold` locks it and keeps its rest look instead of the sticky one, `alt` swaps the bar to its
 * alternate look.
 */
export type TZoneKind = 'hide' | 'lock' | 'hold' | 'alt'
