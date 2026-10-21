/**
 * Adapter for the Horizontal Scroll plugin. A pinned horizontal section moves its panels sideways
 * while the page scrolls, so a panel's own rect says nothing about when the header's center point
 * sits over it. The plugin answers that as a scroll window instead; this module turns the window
 * into a synthetic document-space rect so the zone tick stays pure arithmetic. The global is read
 * through a local structural interface, never imported: there is no build-time link between the
 * two packages. A build that lacks the newer optional fields keeps the window path, with no band
 * gate and release treated as false; only a missing global, contract < 1, or a null range takes
 * the rect path.
 */

/** Wrapper element of a horizontal section; its bubbling layout event is the rescan trigger. */
export const HS_WRAPPER_SELECTOR = '.js-arts-hs'
export const HS_LAYOUT_EVENT = 'arts-hs:layout'

/** The slice of the plugin's range result this adapter reads; newer fields stay optional. */
export interface IHorizontalScrollRangeLike {
  start: number
  end: number
  onStageAtEngage: boolean
  onStageAtRelease?: boolean
  stageTop?: number
  stageHeight?: number
}

interface IHorizontalScrollGlobalLike {
  contract: number
  getScrollRange(target: Element, options?: { point?: number }): IHorizontalScrollRangeLike | null
}

/** `window.artsHorizontalScroll` of the engine's own realm, when it carries a usable contract. */
export const readHorizontalScrollGlobal = (): IHorizontalScrollGlobalLike | undefined => {
  if (typeof window === 'undefined') {
    return undefined
  }
  const api = (window as { artsHorizontalScroll?: Partial<IHorizontalScrollGlobalLike> })
    .artsHorizontalScroll
  if (typeof api?.getScrollRange !== 'function' || !(Number(api.contract) >= 1)) {
    return undefined
  }
  return api as IHorizontalScrollGlobalLike
}

/**
 * The stage fraction the header's center x lands on, clamped to [0, 1]; 0.5 when any input is
 * non-finite or the width is 0 (a rect stub without left/width must not become a NaN window).
 */
export const stagePoint = (centerX: number, sectionLeft: number, sectionWidth: number): number => {
  if (
    !Number.isFinite(centerX) ||
    !Number.isFinite(sectionLeft) ||
    !Number.isFinite(sectionWidth) ||
    sectionWidth <= 0
  ) {
    return 0.5
  }
  return Math.min(1, Math.max(0, (centerX - sectionLeft) / sectionWidth))
}

/**
 * The synthetic doc-space rect for a panel's window, or null when the decider line misses the
 * pinned band.
 */
export const resolveHorizontalZoneRect = (
  range: IHorizontalScrollRangeLike,
  sectionTop: number,
  sectionBottom: number,
  decider: number
): { top: number; bottom: number } | null => {
  const { stageTop, stageHeight } = range
  if (
    typeof stageTop === 'number' &&
    typeof stageHeight === 'number' &&
    !(stageTop <= decider && decider < stageTop + stageHeight)
  ) {
    return null
  }
  return {
    top: range.onStageAtEngage ? sectionTop : range.start + decider,
    bottom: range.onStageAtRelease === true ? sectionBottom : range.end + decider
  }
}

/**
 * Layout-reading. `undefined`: not a horizontal panel, no global, or a null range (the caller
 * measures the element's own rect); `'drop'`: the band gate rejected it; otherwise the synthetic
 * rect. `getCenterX` is called at most once per scan.
 */
export const measureHorizontalZone = (
  element: HTMLElement,
  getCenterX: () => number,
  decider: number
): { top: number; bottom: number } | 'drop' | undefined => {
  const section = element.closest(HS_WRAPPER_SELECTOR)
  const api = section ? readHorizontalScrollGlobal() : undefined
  if (!section || !api) {
    return undefined
  }
  const sectionRect = section.getBoundingClientRect()
  const range = api.getScrollRange(element, {
    point: stagePoint(getCenterX(), sectionRect.left, sectionRect.width)
  })
  if (!range) {
    return undefined
  }
  return (
    resolveHorizontalZoneRect(
      range,
      Math.round(sectionRect.top + window.scrollY),
      Math.round(sectionRect.bottom + window.scrollY),
      decider
    ) ?? 'drop'
  )
}
