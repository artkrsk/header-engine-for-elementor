import type {
  IHeaderOptions,
  IHeightObserverOptions,
  IRevealOptions,
  IStickyOptions
} from '../interfaces'
import type { TRevealMode, TToggleAttributes } from '../types'

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

const asFiniteNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined

const asRevealMode = (value: unknown): TRevealMode | undefined =>
  value === 'auto-hide' || value === 'scrub' ? value : undefined

export const sanitizeReveal = (raw: unknown): IRevealOptions | false | undefined => {
  if (raw === false) {
    return false
  }
  if (!isPlainObject(raw)) {
    return undefined
  }
  const out: IRevealOptions = {}
  const mode = asRevealMode(raw.mode)
  if (mode !== undefined) {
    out.mode = mode
  }
  const offset = asFiniteNumber(raw.offset)
  if (offset !== undefined) {
    out.offset = offset
  }
  return out
}

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
  const reveal = sanitizeReveal(raw.reveal)
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
