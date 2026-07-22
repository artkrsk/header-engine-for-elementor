/** A tracked hide-over / lock-over zone and its live intersection state. */
export interface IZone {
  element: HTMLElement
  kind: 'hide' | 'lock'
  observer: IntersectionObserver
  active: boolean
}
