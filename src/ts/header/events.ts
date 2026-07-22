import type { IHeaderEventDetail } from '../interfaces'
import type { THeaderEventName } from '../types'

/**
 * Public header state events, dispatched on `document` as CustomEvents so consumers outside the
 * bundle can subscribe with plain `document.addEventListener`. These helpers are the single
 * dispatch/listen mechanism — there is no separate internal emitter.
 */
export function dispatchHeaderEvent(name: THeaderEventName, detail: IHeaderEventDetail): void {
  document.dispatchEvent(new CustomEvent<IHeaderEventDetail>(name, { detail }))
}

export function onHeaderEvent(
  name: THeaderEventName,
  listener: (event: CustomEvent<IHeaderEventDetail>) => void,
  options?: AddEventListenerOptions
): void {
  document.addEventListener(name, listener as EventListener, options)
}

export function offHeaderEvent(
  name: THeaderEventName,
  listener: (event: CustomEvent<IHeaderEventDetail>) => void,
  options?: EventListenerOptions
): void {
  document.removeEventListener(name, listener as EventListener, options)
}
