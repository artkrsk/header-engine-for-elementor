import type { IResolvedHeaderOptions } from '../interfaces/IResolvedHeaderOptions'
import type { IResolvedHeightObserverOptions } from '../interfaces/IResolvedHeightObserverOptions'
import type { IResolvedRevealOptions } from '../interfaces/IResolvedRevealOptions'
import type { IResolvedStickyOptions } from '../interfaces/IResolvedStickyOptions'

/**
 * Canonical resolved defaults, stated once per section. The per-section resolvers in
 * `options/headerOptions.ts` read these fields as their fallback values and always build fresh
 * objects — nothing at runtime ever aliases (or mutates) these.
 */

export const defaultRevealOptions: IResolvedRevealOptions = {
  mode: 'auto-hide',
  offset: 0
}

export const defaultStickyOptions: IResolvedStickyOptions = {
  trigger: undefined,
  reveal: defaultRevealOptions,
  until: undefined,
  toggleAttributes: false
}

export const defaultHeightObserverOptions: IResolvedHeightObserverOptions = {
  observe: true,
  cleanupOnDestroy: false
}

export const defaultHeaderOptions: IResolvedHeaderOptions = {
  sticky: defaultStickyOptions,
  heightObserver: defaultHeightObserverOptions
}
