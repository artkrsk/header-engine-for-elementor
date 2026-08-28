import type { TToggleAttributes } from '../types/TToggleAttributes'

/**
 * Sticky options after resolution. `trigger`/`until` are required-but-possibly-undefined so the
 * resolver forwards them verbatim under `exactOptionalPropertyTypes`; the other fields are
 * concrete, never `undefined`.
 */
export interface IResolvedStickyOptions {
  trigger: string | HTMLElement | undefined
  reveal: boolean
  until: string | HTMLElement | undefined
  toggleAttributes: TToggleAttributes | false
  zones: boolean
}
