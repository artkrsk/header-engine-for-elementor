import {
  defaultHeightObserverOptions,
  defaultRevealOptions,
  defaultStickyOptions
} from '../constants'
import type {
  IHeaderOptions,
  IResolvedHeaderOptions,
  IResolvedHeightObserverOptions,
  IResolvedRevealOptions,
  IResolvedStickyOptions,
  IStickyOptions
} from '../interfaces'

/**
 * One pure resolver per section: `false` disables, anything else fills the gaps from the canonical
 * defaults. Every resolver returns a fresh object — resolved options are never aliased to the
 * defaults or to caller input, so a consumer mutation can't corrupt shared state.
 */

export const resolveReveal = (value: IStickyOptions['reveal']): IResolvedRevealOptions | false =>
  value === false
    ? false
    : {
        mode: value?.mode ?? defaultRevealOptions.mode,
        offset: value?.offset ?? defaultRevealOptions.offset
      }

export const resolveSticky = (value: IHeaderOptions['sticky']): IResolvedStickyOptions | false =>
  value === false
    ? false
    : {
        trigger: value?.trigger,
        reveal: resolveReveal(value?.reveal),
        until: value?.until,
        // Replaces wholesale — a caller's map is taken as-is, never key-merged with a default.
        toggleAttributes: value?.toggleAttributes ?? defaultStickyOptions.toggleAttributes
      }

export const resolveHeightObserver = (
  value: IHeaderOptions['heightObserver']
): IResolvedHeightObserverOptions | false =>
  value === false
    ? false
    : {
        observe: value?.observe ?? defaultHeightObserverOptions.observe,
        cleanupOnDestroy: value?.cleanupOnDestroy ?? defaultHeightObserverOptions.cleanupOnDestroy
      }

export function resolveHeaderOptions(overrides?: IHeaderOptions): IResolvedHeaderOptions {
  return {
    sticky: resolveSticky(overrides?.sticky),
    heightObserver: resolveHeightObserver(overrides?.heightObserver)
  }
}
