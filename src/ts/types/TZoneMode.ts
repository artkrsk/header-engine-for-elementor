/**
 * Intersection strategy for a hide-over / lock-over zone: `at-top` — the zone occupies the top of
 * the screen where the header docks; `overlap` — the zone overlaps the header bar itself;
 * `in-view` — any part of the zone is on screen.
 */
export type TZoneMode = 'at-top' | 'overlap' | 'in-view'
