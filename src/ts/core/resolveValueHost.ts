import { VALUE_HOST_JS_CLASS } from '../constants/dom'

/** The wrapper's nonanimated value host (Elementor markup), or null for standalone markup. */
export const resolveValueHost = (container: HTMLElement): HTMLElement | null =>
  container.parentElement?.classList.contains(VALUE_HOST_JS_CLASS) ? container.parentElement : null
