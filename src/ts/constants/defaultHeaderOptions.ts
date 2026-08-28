import type { IResolvedHeaderOptions } from '../interfaces/IResolvedHeaderOptions'
import type { IResolvedHeightObserverOptions } from '../interfaces/IResolvedHeightObserverOptions'
import type { IResolvedStickyOptions } from '../interfaces/IResolvedStickyOptions'

/**
 * Canonical resolved defaults, stated once per section. The per-section resolvers in
 * `options/headerOptions.ts` read these fields as their fallback values and always build fresh
 * objects — nothing at runtime ever aliases (or mutates) these.
 */

export const defaultStickyOptions: IResolvedStickyOptions = {
  trigger: undefined,
  reveal: true,
  until: undefined,
  toggleAttributes: false,
  zones: true
}

export const defaultHeightObserverOptions: IResolvedHeightObserverOptions = {
  observe: true,
  cleanupOnDestroy: false
}

export const defaultHeaderOptions: IResolvedHeaderOptions = {
  sticky: defaultStickyOptions,
  heightObserver: defaultHeightObserverOptions
}
