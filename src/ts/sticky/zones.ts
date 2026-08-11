import { HIDE_ZONE_ATTR, LOCK_ZONE_ATTR } from '../constants'
import type { IZone } from '../interfaces'
import type { TZoneKind, TZoneMode } from '../types'

/**
 * Hide-over / lock-over zones, declared on arbitrary page elements via data attributes. Each zone
 * is watched by its own IntersectionObserver whose geometry the pure deciders compute; a body-wide
 * MutationObserver re-scans (rAF-coalesced) when zone attributes are added/removed elsewhere —
 * e.g. a sibling plugin toggling them on breakpoint layout swaps.
 */

/** Parse a zone attribute value; anything unrecognized falls back to `at-top`. */
export const readZoneMode = (raw: string | null): TZoneMode =>
  raw === 'overlap' || raw === 'in-view' ? raw : 'at-top'

/**
 * The observer rootMargin per mode. `at-top` pins the root to the viewport's top edge line (usable
 * on zones taller than the viewport, where thresholds never approach 1); `overlap` shrinks the root
 * to the header strip [stickyTop, stickyTop + barHeight] (the `below` inset floors at 0 when the
 * strip covers the whole viewport); `in-view` is any viewport intersection.
 */
export const zoneRootMargin = (
  mode: TZoneMode,
  stickyTop: number,
  barHeight: number,
  innerHeight: number
): string => {
  if (mode === 'at-top') {
    return '0px 0px -100% 0px'
  }
  if (mode === 'overlap') {
    const line = stickyTop + barHeight
    const below = Math.max(0, Math.round(innerHeight - line))
    return `${-Math.round(stickyTop)}px 0px ${-below}px 0px`
  }
  return '0px'
}

/** Combine live zone states: any active zone of a kind drives that kind, independently. */
export const reduceZones = (
  zones: readonly { kind: TZoneKind; active: boolean }[]
): { anyHide: boolean; anyLock: boolean } => ({
  anyHide: zones.some((zone) => zone.kind === 'hide' && zone.active),
  anyLock: zones.some((zone) => zone.kind === 'lock' && zone.active)
})

export function createZoneTracker(args: {
  getStickyTop: () => number
  getBarHeight: () => number
  onChange: (anyHide: boolean, anyLock: boolean) => void
}): { refresh(): void; destroy(): void } {
  let zones: IZone[] = []
  let rescanRafId = 0
  let rescanQueued = false

  const emitChange = (): void => {
    const { anyHide, anyLock } = reduceZones(zones)
    args.onChange(anyHide, anyLock)
  }

  const observeZone = (element: HTMLElement, kind: TZoneKind, mode: TZoneMode): void => {
    // Margins are computed at observe time; `refresh()` re-arms them.
    const rootMargin = zoneRootMargin(
      mode,
      args.getStickyTop(),
      args.getBarHeight(),
      window.innerHeight
    )
    const zone: IZone = {
      element,
      kind,
      active: false,
      observer: new IntersectionObserver(onEntries, { rootMargin, threshold: [0] })
    }
    function onEntries(entries: IntersectionObserverEntry[]): void {
      const entry = entries.at(-1)
      if (!entry) {
        return
      }
      zone.active = entry.isIntersecting
      emitChange()
    }
    zones.push(zone)
    zone.observer.observe(element)
  }

  const teardown = (): void => {
    for (const zone of zones) {
      zone.observer.disconnect()
    }
    zones = []
  }

  const scan = (): void => {
    for (const el of document.querySelectorAll<HTMLElement>(`[${HIDE_ZONE_ATTR}]`)) {
      observeZone(el, 'hide', readZoneMode(el.getAttribute(HIDE_ZONE_ATTR)))
    }
    for (const el of document.querySelectorAll<HTMLElement>(`[${LOCK_ZONE_ATTR}]`)) {
      observeZone(el, 'lock', readZoneMode(el.getAttribute(LOCK_ZONE_ATTR)))
    }
  }

  const refresh = (): void => {
    teardown()
    scan()
  }

  // Coalesce a same-tick attribute-mutation burst into one rescan instead of one per mutation.
  const scheduleRescan = (): void => {
    if (rescanQueued) {
      return
    }
    rescanQueued = true
    rescanRafId = requestAnimationFrame(() => {
      rescanQueued = false
      refresh()
    })
  }

  const mutationObserver = new MutationObserver(scheduleRescan)
  mutationObserver.observe(document.body, {
    attributes: true,
    subtree: true,
    attributeFilter: [HIDE_ZONE_ATTR, LOCK_ZONE_ATTR]
  })

  scan()

  return {
    refresh,
    destroy() {
      teardown()
      mutationObserver.disconnect()
      cancelAnimationFrame(rescanRafId)
      rescanQueued = false
    }
  }
}
