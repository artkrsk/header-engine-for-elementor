/**
 * Intersection strategy for a hide-over / lock-over zone: `at-top` — the zone occupies the top of
 * the screen where the header docks; `overlap` — the zone overlaps the header bar itself;
 * `in-view` — any part of the zone is on screen; `center` — the zone covers the header's vertical
 * center. `center` is engine-internal (the alt kind and Horizontal Scroll panels); it is never
 * read from an attribute.
 */
export type TZoneMode = 'at-top' | 'overlap' | 'in-view' | 'center'
