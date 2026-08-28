import type { TPinLine } from '../types/TPinLine'

/**
 * Layout-forcing metric reads — called at construction and refresh, never inside a frame — plus
 * the one write-side setup they depend on: registering the reveal-offset var as a `<length>` so
 * its computed value arrives pre-resolved to px.
 */

/** The bar's rendered border-box height, rounded to whole pixels. */
export const measureBar = (bar: HTMLElement): number =>
  Math.round(bar.getBoundingClientRect().height)

/** The styles' viewport-pinned admin-bar allowance (see `_modes.scss`). */
const PINNED_TOP_VAR = '--arts-header-top-pinned'

/**
 * The pin line (viewport Y where the header locks): the admin-bar offset as the STYLES resolved it
 * for viewport-pinned consumers. Deliberately not `<html>` margin-top — WordPress keeps that bump
 * (and `--wp-admin--admin-bar--height`) at 46px below 600px, where it drops #wpadminbar to
 * `position: absolute` and the bar scrolls away, so margin-top would report a line the bar has
 * already passed. Read off the container rather than its computed `top` — a bottom-docked wrapper
 * (hero-bottom at rest) reports its docked offset, not the pin line.
 */
export const measureStickyTop = (container: HTMLElement): number =>
  Math.max(0, parseRevealOffset(getComputedStyle(container).getPropertyValue(PINNED_TOP_VAR)))

/**
 * Pure: derive the pin line from the wrapper's computed positioning. A sticky wrapper pins where
 * its own CSS says (custom `--arts-header-pin-offset` and negative compact-header offsets
 * included); `top: auto` means the bottom-pinned flow variant. Everything else (overlay fixed,
 * static, hero-bottom's absolute rest state) keeps the admin-bar line — reading THEIR computed
 * top would report a docked offset, not the pin line.
 */
export const resolvePinLine = (
  position: string,
  top: string,
  bottom: string,
  adminOffset: number
): TPinLine => {
  if (position === 'sticky') {
    if (top === 'auto') {
      const parsedBottom = parseFloat(bottom)
      return { edge: 'bottom', offset: Number.isFinite(parsedBottom) ? parsedBottom : 0 }
    }
    const parsedTop = parseFloat(top)
    return { edge: 'top', offset: Number.isFinite(parsedTop) ? parsedTop : adminOffset }
  }
  return { edge: 'top', offset: adminOffset }
}

/** Layout-forcing read of the wrapper's pin line (see resolvePinLine). */
export const measurePinLine = (container: HTMLElement): TPinLine => {
  const cs = getComputedStyle(container)
  return resolvePinLine(cs.position, cs.top, cs.bottom, measureStickyTop(container))
}

/**
 * Doc-space natural top of the wrapper, or null when it cannot be derived right now — a PINNED
 * sticky wrapper's rect sits at the pin line rather than its slot, and fixed/absolute wrappers
 * never reflect their slot. The caller keeps its previous value on null.
 */
export const measureNaturalTop = (
  container: HTMLElement,
  trigger: HTMLElement | null,
  pin: TPinLine
): number | null => {
  if (trigger) {
    return Math.round(trigger.getBoundingClientRect().top + window.scrollY)
  }
  const position = getComputedStyle(container).position
  if (position === 'fixed' || position === 'absolute') {
    return null
  }
  const rect = container.getBoundingClientRect()
  if (position === 'sticky') {
    const clearOfPin =
      pin.edge === 'bottom'
        ? rect.bottom < window.innerHeight - pin.offset - 1
        : rect.top > pin.offset + 1
    if (!clearOfPin) {
      return null
    }
  }
  return Math.round(rect.top + window.scrollY)
}

/**
 * Slot-anchored estimate for when the wrapper's own rect is ambiguous (boot while pinned,
 * out-of-flow modes): the previous element sibling's bottom (not skipped if it is itself out of
 * flow), else the parent's top. Off by collapsed margins / flex gap at worst; a later unpinned
 * measure corrects it.
 */
export const estimateNaturalTop = (container: HTMLElement): number => {
  const sibling = container.previousElementSibling
  const anchor = sibling ?? container.parentElement
  if (!anchor) {
    return 0
  }
  const rect = anchor.getBoundingClientRect()
  return Math.round((sibling ? rect.bottom : rect.top) + window.scrollY)
}

/**
 * Parse a computed reveal-offset value into scroll pixels. With the property registered as a
 * `<length>`, the computed value is always an absolute `Npx` — `100vh`, `em`, and `calc()` arrive
 * pre-resolved by the browser. The px-token guard is the unregistered fallback (old browsers,
 * happy-dom): raw non-px tokens can't be resolved there, so they read as 0.
 */
export const parseRevealOffset = (raw: string): number => {
  const value = raw.trim()
  if (!value.endsWith('px')) {
    return 0
  }
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/** The reveal offset var, resolved at the container (the panel writes it there; themes may too). */
export const measureRevealOffset = (container: HTMLElement, varName: string): number =>
  parseRevealOffset(getComputedStyle(container).getPropertyValue(varName))

/**
 * Register the reveal-offset var as an inheriting `<length>` so its computed value resolves to
 * absolute px. Safe to call per instance: re-registration throws and is swallowed — the first
 * registration in a realm stands.
 */
export const registerRevealOffsetProperty = (name: string): void => {
  if (typeof CSS === 'undefined' || typeof CSS.registerProperty !== 'function') {
    return
  }
  try {
    CSS.registerProperty({ name, syntax: '<length>', inherits: true, initialValue: '0px' })
  } catch {
    // Already registered in this realm.
  }
}
