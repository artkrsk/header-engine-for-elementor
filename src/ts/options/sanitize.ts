import type { IHeaderOptions, IHeightObserverOptions, IStickyOptions } from '../interfaces'
import type { TToggleAttributes } from '../types'

/**
 * Field guards for untrusted inline JSON. Each returns `undefined` for anything malformed so the
 * resolvers' defaults win downstream — one bad field never rejects its surrounding section. Only
 * JSON-expressible shapes are accepted (an element reference can't arrive through an attribute, so
 * `trigger`/`until` admit selector strings only).
 */

export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const asBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined

export const sanitizeToggleAttributes = (raw: unknown): TToggleAttributes | false | undefined => {
  if (raw === false) {
    return false
  }
  if (!isPlainObject(raw)) {
    return undefined
  }
  const out: TToggleAttributes = {}
  for (const [attribute, entry] of Object.entries(raw)) {
    if (!isPlainObject(entry)) {
      continue
    }
    const swap: TToggleAttributes[string] = {}
    const inactive = asString(entry.inactive)
    if (inactive !== undefined) {
      swap.inactive = inactive
    }
    const active = asString(entry.active)
    if (active !== undefined) {
      swap.active = active
    }
    out[attribute] = swap
  }
  return out
}

export const sanitizeSticky = (raw: unknown): IStickyOptions | false | undefined => {
  if (raw === false) {
    return false
  }
  if (!isPlainObject(raw)) {
    return undefined
  }
  const out: IStickyOptions = {}
  const trigger = asString(raw.trigger)
  if (trigger !== undefined) {
    out.trigger = trigger
  }
  const reveal = asBoolean(raw.reveal)
  if (reveal !== undefined) {
    out.reveal = reveal
  }
  const until = asString(raw.until)
  if (until !== undefined) {
    out.until = until
  }
  const toggleAttributes = sanitizeToggleAttributes(raw.toggleAttributes)
  if (toggleAttributes !== undefined) {
    out.toggleAttributes = toggleAttributes
  }
  const zones = asBoolean(raw.zones)
  if (zones !== undefined) {
    out.zones = zones
  }
  return out
}

export const sanitizeHeightObserver = (
  raw: unknown
): IHeightObserverOptions | false | undefined => {
  if (raw === false) {
    return false
  }
  if (!isPlainObject(raw)) {
    return undefined
  }
  const out: IHeightObserverOptions = {}
  const observe = asBoolean(raw.observe)
  if (observe !== undefined) {
    out.observe = observe
  }
  const cleanupOnDestroy = asBoolean(raw.cleanupOnDestroy)
  if (cleanupOnDestroy !== undefined) {
    out.cleanupOnDestroy = cleanupOnDestroy
  }
  return out
}

export const sanitizeInlineOptions = (raw: unknown): IHeaderOptions => {
  if (!isPlainObject(raw)) {
    return {}
  }
  const out: IHeaderOptions = {}
  const sticky = sanitizeSticky(raw.sticky)
  if (sticky !== undefined) {
    out.sticky = sticky
  }
  const heightObserver = sanitizeHeightObserver(raw.heightObserver)
  if (heightObserver !== undefined) {
    out.heightObserver = heightObserver
  }
  return out
}
