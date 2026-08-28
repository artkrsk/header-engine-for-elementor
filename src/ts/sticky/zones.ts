import { HIDE_ZONE_ATTR, LOCK_ZONE_ATTR } from '../constants'
import type { TZoneKind, TZoneMode } from '../types'
import { coalesceToFrame } from '../utils'

/**
 * Hide-over / lock-over zones, declared on arbitrary page elements via data attributes. Zone
 * activity is pure geometry against document-space rects cached at scan/measure passes, evaluated
 * on the scroll tick — no per-zone observers. A body-wide MutationObserver re-scans
 * (rAF-coalesced) when zone attributes change elsewhere. Trade-off, documented: a zone whose rect
 * changes mid-scroll (animation, lazy content) lags until a settled re-measure trigger.
 */

/** Parse a zone attribute value; anything unrecognized falls back to `at-top`. */
export const readZoneMode = (raw: string | null): TZoneMode =>
  raw === 'overlap' || raw === 'in-view' ? raw : 'at-top'

/**
 * Zone activity per geometry, in document space. `at-top`: the zone spans the viewport's top
 * line; `overlap`: it intersects the header strip [pinLine, pinLine + barHeight]; `in-view`: any
 * viewport intersection. Mirrors the old IO rootMargin geometries exactly.
 */
export const resolveZoneActive = (
  mode: TZoneMode,
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
): { anyHide: boolean; anyLock: boolean } => ({
  anyHide: zones.some((zone) => zone.kind === 'hide' && zone.active),
  anyLock: zones.some((zone) => zone.kind === 'lock' && zone.active)
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
  getPinLine: () => number
  getBarHeight: () => number
  getViewportH: () => number
  onChange: (anyHide: boolean, anyLock: boolean) => void
}): { refresh(y?: number): void; evaluate(y: number): void; destroy(): void } {
  let zones: ITrackedZone[] = []
  let lastY = 0
  let lastHide = false
  let lastLock = false

  const scan = (): void => {
    zones = []
    const collect = (attr: string, kind: TZoneKind): void => {
      for (const element of document.querySelectorAll<HTMLElement>(`[${attr}]`)) {
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
    for (const zone of zones) {
      const rect = zone.element.getBoundingClientRect()
      zone.top = Math.round(rect.top + window.scrollY)
      zone.bottom = Math.round(rect.bottom + window.scrollY)
    }
  }

  const evaluate = (y: number): void => {
    lastY = y
    for (const zone of zones) {
      zone.active = resolveZoneActive(
        zone.mode,
        zone.top,
        zone.bottom,
        y,
        args.getViewportH(),
        args.getPinLine(),
        args.getBarHeight()
      )
    }
    const { anyHide, anyLock } = reduceZones(zones)
    if (anyHide !== lastHide || anyLock !== lastLock) {
      lastHide = anyHide
      lastLock = anyLock
      args.onChange(anyHide, anyLock)
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
    attributeFilter: [HIDE_ZONE_ATTR, LOCK_ZONE_ATTR]
  })

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
      rescan.cancel()
    }
  }
}
