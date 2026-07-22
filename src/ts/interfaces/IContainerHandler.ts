import type { Frontend } from '@artemsemkin/elementor-types'
import type { TOnDestroyCallback } from '../types/TOnDestroyCallback'
import type { TOnInitCallback } from '../types/TOnInitCallback'

/**
 * Shape of the editor container handler. Typed as an interface (not a class) because Elementor's
 * `Base.extend()` object-literal pattern can't be expressed with class inheritance.
 */
export interface IContainerHandler extends Frontend.Handlers.Base {
  isLoading: boolean
  wrapperEl?: HTMLElement
  el: HTMLElement
  setHeader(): void
  initHeader(onInit: TOnInitCallback, onDestroy: TOnDestroyCallback): Promise<void>
  setHeaderOptions(): void
  setHeaderBarLogo(): void
  removeHeaderBarLogo(): void
  toggleHeaderBarAttributes(toggle?: boolean): void
  toggleHeaderBarSticky(toggle?: boolean): void
  removeHeaderBarSticky(): void
  toggleWrapper(toggle?: boolean): void
  addWrapper(): void
  removeWrapper(): void
}
