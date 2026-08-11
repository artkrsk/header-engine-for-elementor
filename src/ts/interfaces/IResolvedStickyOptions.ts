import type { TToggleAttributes } from '../types/TToggleAttributes'
import type { IResolvedRevealOptions } from './IResolvedRevealOptions'

/**
 * Sticky options after resolution. `trigger`/`until` are required-but-possibly-undefined so the
 * resolver forwards them verbatim under `exactOptionalPropertyTypes`; the sub-sections are
 * concretely `false` or fully populated, never `undefined`.
 */
export interface IResolvedStickyOptions {
  trigger: string | HTMLElement | undefined
  reveal: IResolvedRevealOptions | false
  until: string | HTMLElement | undefined
  toggleAttributes: TToggleAttributes | false
}
