import {
  ALT_ZONE_ATTR,
  HIDE_ZONE_ATTR,
  IGNORE_ATTR,
  LOCK_ZONE_ATTR,
  ZONE_ATTR,
  ZONE_GEOMETRY_VAR,
  ZONE_KIND_VAR,
  ZONE_LOOK_ATTR,
  ZONE_LOOK_VAR
} from '../constants'
import type { TZoneKind, TZoneMode } from '../types'
import { coalesceToFrame, isIgnored } from '../utils'
import { HS_LAYOUT_EVENT, measureHorizontalZone } from './horizontalScroll'

/**
 * Hide-over / lock-over / alt-over zones, declared on arbitrary page elements via data
 * attributes. Zone activity is pure geometry against document-space rects cached at scan/measure
 * passes, evaluated on the scroll tick — no per-zone observers. A body-wide MutationObserver
 * re-scans (rAF-coalesced) when zone attributes change elsewhere. Trade-off, documented: a zone
 * whose rect changes mid-scroll (animation, lazy content) lags until a settled re-measure
 * trigger. The `alt` kind is active while the bar's center line (viewport space) lies inside the
 * zone's rect. A zone inside a Horizontal Scroll section gets a synthetic rect from the plugin's
 * scroll window for its panel (see `horizontalScroll.ts`) and is evaluated with the center rule.
 */

/** Parse a zone attribute value; anything unrecognized falls back to `at-top`. */
export const readZoneMode = (raw: string | null): TZoneMode =>
  raw === 'overlap' || raw === 'in-view' ? raw : 'at-top'

/** Parse the resolved kind var of a marked zone; `none`, unset, or anything else is no zone. */
export const readZoneKind = (raw: string): TZoneKind | null =>
  raw === 'hide' || raw === 'lock' || raw === 'hold' ? raw : null

/** Parse the resolved look var of a marked zone; only `alt` makes a zone. */
export const readZoneLook = (raw: string): boolean => raw.trim() === 'alt'

/** `center`: the viewport-space decider line (bar center) lies inside the zone's rect. */
export const resolveCenterActive = (
  rectTop: number,
  rectBottom: number,
  y: number,
  decider: number
): boolean => rectTop <= y + decider && y + decider < rectBottom

/**
 * Zone activity per geometry, in document space. `at-top`: the zone spans the viewport's top
 * line; `overlap`: it intersects the header strip [pinLine, pinLine + barHeight]; `in-view`: any
 * viewport intersection. Mirrors the old IO rootMargin geometries exactly.
 */
export const resolveZoneActive = (
  mode: Exclude<TZoneMode, 'center'>,
  rectTop: number,
  rectBottom: number,
  y: number,
  viewportH: number,
  pinLine: number,
  barHeight: number
): boolean => {
  const viewTop = rectTop - y
  const viewBottom = rectBottom - y
  if (mode === 'at-top') {
    return viewTop <= 0 && viewBottom > 0
  }
  if (mode === 'overlap') {
    return viewTop < pinLine + barHeight && viewBottom > pinLine
  }
  return viewTop < viewportH && viewBottom > 0
}

/** Combine live zone states: any active zone of a kind drives that kind, independently. */
export const reduceZones = (
  zones: readonly { kind: TZoneKind; active: boolean }[]
): { anyHide: boolean; anyLock: boolean; anyHold: boolean; anyAlt: boolean } => ({
  anyHide: zones.some((zone) => zone.kind === 'hide' && zone.active),
  anyLock: zones.some((zone) => zone.kind === 'lock' && zone.active),
  anyHold: zones.some((zone) => zone.kind === 'hold' && zone.active),
  anyAlt: zones.some((zone) => zone.kind === 'alt' && zone.active)
})

interface ITrackedZone {
  element: HTMLElement
  kind: TZoneKind
  mode: TZoneMode
  top: number
  bottom: number
  active: boolean
}

export function createZoneTracker(args: {
  container: HTMLElement
  getPinLine: () => number
  getBarHeight: () => number
  getViewportH: () => number
  /** Viewport-space y of the bar's center line, the reference for `center` zones. */
  getDecider: () => number
  onChange: (anyHide: boolean, anyLock: boolean, anyHold: boolean, anyAlt: boolean) => void
}): { refresh(y?: number): void; evaluate(y: number): void; destroy(): void } {
  let zones: ITrackedZone[] = []
  let lastY = 0
  let lastHide = false
  let lastLock = false
  let lastHold = false
  let lastAlt = false

  const scan = (): void => {
    zones = []
    const collect = (attr: string, kind: TZoneKind): void => {
      for (const element of document.querySelectorAll<HTMLElement>(`[${attr}]`)) {
        if (isIgnored(element)) {
          continue
        }
        zones.push({
          element,
          kind,
          mode: readZoneMode(element.getAttribute(attr)),
          top: 0,
          bottom: 0,
          active: false
        })
      }
    }
    collect(HIDE_ZONE_ATTR, 'hide')
    collect(LOCK_ZONE_ATTR, 'lock')
    // Presence-only: the value is never parsed, so it can't go through `readZoneMode`.
    for (const element of document.querySelectorAll<HTMLElement>(`[${ALT_ZONE_ATTR}]`)) {
      if (isIgnored(element)) {
        continue
      }
      zones.push({ element, kind: 'alt', mode: 'center', top: 0, bottom: 0, active: false })
    }
    // Panel zones: kind and geometry are responsive CSS vars, so the values resolved at THIS scan
    // decide (a settled resize re-scans through the measure pass). A var Elementor hasn't written
    // yet (stale generated CSS after an update) falls back to the desktop value in the marker.
    for (const element of document.querySelectorAll<HTMLElement>(`[${ZONE_ATTR}]`)) {
      if (isIgnored(element)) {
        continue
      }
      const style = getComputedStyle(element)
      const [fallbackKind = '', fallbackGeometry = ''] = (
        element.getAttribute(ZONE_ATTR) ?? ''
      ).split(':')
      const kind = readZoneKind(style.getPropertyValue(ZONE_KIND_VAR).trim() || fallbackKind)
      if (kind) {
        zones.push({
          element,
          kind,
          mode: readZoneMode(style.getPropertyValue(ZONE_GEOMETRY_VAR).trim() || fallbackGeometry),
          top: 0,
          bottom: 0,
          active: false
        })
      }
    }
    // Look zones are independent of the kind/geometry pass above: one container can be both a
    // hide/lock zone and an alt zone. The marker value is the desktop fallback for an unwritten
    // var, same as `ZONE_ATTR`.
    for (const element of document.querySelectorAll<HTMLElement>(`[${ZONE_LOOK_ATTR}]`)) {
      if (isIgnored(element)) {
        continue
      }
      const look =
        getComputedStyle(element).getPropertyValue(ZONE_LOOK_VAR).trim() ||
        (element.getAttribute(ZONE_LOOK_ATTR) ?? '')
      if (readZoneLook(look)) {
        zones.push({ element, kind: 'alt', mode: 'center', top: 0, bottom: 0, active: false })
      }
    }
    // One container rect read per scan, and only when a horizontal panel asks for it.
    let centerX: number | undefined
    const getCenterX = (): number => {
      if (centerX === undefined) {
        const rect = args.container.getBoundingClientRect()
        centerX = rect.left + rect.width / 2
      }
      return centerX
    }
    const decider = args.getDecider()
    zones = zones.filter((zone) => {
      const horizontal = measureHorizontalZone(zone.element, getCenterX, decider)
      if (horizontal === 'drop') {
        return false
      }
      if (horizontal) {
        zone.top = horizontal.top
        zone.bottom = horizontal.bottom
        zone.mode = 'center'
        return true
      }
      const rect = zone.element.getBoundingClientRect()
      zone.top = Math.round(rect.top + window.scrollY)
      zone.bottom = Math.round(rect.bottom + window.scrollY)
      return true
    })
  }

  const evaluate = (y: number): void => {
    lastY = y
    for (const zone of zones) {
      zone.active =
        zone.mode === 'center'
          ? resolveCenterActive(zone.top, zone.bottom, y, args.getDecider())
          : resolveZoneActive(
              zone.mode,
              zone.top,
              zone.bottom,
              y,
              args.getViewportH(),
              args.getPinLine(),
              args.getBarHeight()
            )
    }
    const { anyHide, anyLock, anyHold, anyAlt } = reduceZones(zones)
    if (
      anyHide !== lastHide ||
      anyLock !== lastLock ||
      anyHold !== lastHold ||
      anyAlt !== lastAlt
    ) {
      lastHide = anyHide
      lastLock = anyLock
      lastHold = anyHold
      lastAlt = anyAlt
      args.onChange(anyHide, anyLock, anyHold, anyAlt)
    }
  }

  // Coalesce a same-tick attribute-mutation burst into one rescan instead of one per mutation.
  const rescan = coalesceToFrame(() => {
    scan()
    evaluate(lastY)
  })

  const mutationObserver = new MutationObserver(rescan.schedule)
  mutationObserver.observe(document.body, {
    attributes: true,
    subtree: true,
    attributeFilter: [
      HIDE_ZONE_ATTR,
      LOCK_ZONE_ATTR,
      ALT_ZONE_ATTR,
      ZONE_ATTR,
      ZONE_LOOK_ATTR,
      IGNORE_ATTR
    ]
  })

  document.addEventListener(HS_LAYOUT_EVENT, rescan.schedule)

  scan()

  return {
    // A caller that knows the current position passes it — evaluating rescanned rects at the
    // stale tick position could publish a state the very next evaluate flips back (event burst).
    refresh(y) {
      scan()
      evaluate(y ?? lastY)
    },
    evaluate,
    destroy() {
      zones = []
      mutationObserver.disconnect()
      document.removeEventListener(HS_LAYOUT_EVENT, rescan.schedule)
      rescan.cancel()
    }
  }
}
