import type { THeaderMode } from '../types/THeaderMode'
import type { TRevealMode } from '../types/TRevealMode'
import type { TToggleAttributes } from '../types/TToggleAttributes'

/** What the engine consumes after merging with defaults — no optional chaining needed. */
export interface IResolvedHeaderOptions {
  mode: THeaderMode
  sticky: {
    enabled: boolean
    trigger?: string | HTMLElement
    toggleReveal: boolean
    revealMode: TRevealMode
    revealOffset: number
    until?: string | HTMLElement
    toggleAttributes?: TToggleAttributes
  }
  heightObserver: {
    enabled: boolean
    observe: boolean
    cleanupOnDestroy: boolean
  }
}
