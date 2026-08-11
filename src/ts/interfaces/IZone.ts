import type { TZoneKind } from '../types/TZoneKind'

/** A tracked hide-over / lock-over zone and its live intersection state. */
export interface IZone {
  element: HTMLElement
  kind: TZoneKind
  observer: IntersectionObserver
  active: boolean
}
