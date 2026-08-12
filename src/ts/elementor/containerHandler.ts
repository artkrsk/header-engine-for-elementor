import {
  BAR_ABSOLUTE_CLASS,
  BAR_CLASS,
  BAR_FIXED_CLASS,
  BAR_JS_CLASS,
  NON_STICKY_LOGO_ATTR,
  OPTIONS_ATTR,
  STICKY_LOGO_ATTR,
  WRAPPER_CLASS,
  WRAPPER_ELEMENT_ID_PREFIX,
  WRAPPER_JS_CLASS
} from '../constants'
import type { IContainerHandler } from '../interfaces'
import type { TOnDestroyCallback, TOnInitCallback } from '../types'
import { mapPanelSettings } from './mapPanelSettings'

/** Wrap `el` in the header wrapper div, or adopt an existing one; identification matches unwrap. */
const wrapHeaderBar = (el: HTMLElement, elementId: string | number): HTMLElement | null => {
  if (!el.parentNode) {
    return null
  }
  if (
    el.parentElement?.classList.contains(WRAPPER_CLASS) &&
    el.parentElement.classList.contains(WRAPPER_JS_CLASS)
  ) {
    return el.parentElement
  }
  const wrapper = document.createElement('div')
  wrapper.classList.add(WRAPPER_CLASS, `${WRAPPER_ELEMENT_ID_PREFIX}${elementId}`, WRAPPER_JS_CLASS)
  el.parentNode.insertBefore(wrapper, el)
  wrapper.appendChild(el)
  return wrapper
}

/** Move `el` back out of its wrapper; the wrapper is removed only if it ends up empty. */
const unwrapHeaderBar = (el: HTMLElement): void => {
  const parentElement = el.parentElement
  if (
    !parentElement?.classList.contains(WRAPPER_CLASS) ||
    !parentElement.classList.contains(WRAPPER_JS_CLASS) ||
    !parentElement.parentNode
  ) {
    return
  }
  parentElement.parentNode.insertBefore(el, parentElement)
  if (parentElement.children.length === 0) {
    parentElement.remove()
  }
}

/**
 * The slice of Elementor's editor globals this module reaches, typed locally on purpose: consumers
 * compile this source with their own configs, and the repo's ambient Window augmentation
 * (global.d.ts) doesn't travel with the module graph.
 */
interface IElementorEditorGlobals {
  elementorModules?: {
    frontend?: { handlers: { Base: { extend: (props: object) => unknown } } }
  }
  elementorFrontend?: {
    elementsHandler?: {
      attachHandler: (elementType: string, handler: unknown, skin: unknown) => void
    }
  }
}

const editorGlobals = (): IElementorEditorGlobals =>
  typeof window === 'undefined' ? {} : (window as IElementorEditorGlobals)

/**
 * Editor-only container handler: wraps an Elementor Container in the `.arts-header` div, syncs
 * panel settings into `data-arts-header-*` attributes on every change, and re-inits/destroys the
 * live header instance.
 */
export const createContainerHandler = (onInit: TOnInitCallback, onDestroy: TOnDestroyCallback) => {
  return editorGlobals().elementorModules?.frontend?.handlers.Base.extend({
    isLoading: false,

    onInit(this: IContainerHandler) {
      this.el = this.$element.get(0) as HTMLElement
      this.setHeader()
      this.initHeader(onInit, onDestroy)
    },

    // Will re-assign this method later after the header is loaded
    onDestroy(this: IContainerHandler) {},

    setHeader(this: IContainerHandler) {
      const enabled = !!this.getElementSettings('arts_header_enabled')

      this.toggleHeaderBarAttributes(enabled)
      this.toggleWrapper(enabled)
      this.setHeaderOptions()

      if (enabled) {
        const stickyEnabled = !!this.getElementSettings('arts_header_sticky_enabled')
        this.toggleHeaderBarSticky(stickyEnabled)
      } else {
        this.removeHeaderBarSticky()
      }
    },

    async initHeader(
      this: IContainerHandler,
      onInit: TOnInitCallback,
      onDestroy: TOnDestroyCallback
    ) {
      const enabled = !!this.getElementSettings('arts_header_enabled')

      if (enabled) {
        if (!this.isLoading) {
          this.isLoading = true

          await onInit({
            container: this.wrapperEl ?? null,
            bar: this.el
          })

          Object.assign(this, {
            onDestroy
          })

          this.isLoading = false
        }
      } else {
        this.onDestroy()
      }
    },

    setHeaderOptions(this: IContainerHandler) {
      if (!this.wrapperEl) {
        return
      }

      const nonStickyLogoVersion = this.getElementSettings(
        'arts_header_state_non_sticky_logo_version'
      )
      const stickyLogoVersion = this.getElementSettings('arts_header_state_sticky_logo_version')

      if (nonStickyLogoVersion) {
        this.wrapperEl.setAttribute(NON_STICKY_LOGO_ATTR, nonStickyLogoVersion)
      }

      if (stickyLogoVersion) {
        this.wrapperEl.setAttribute(STICKY_LOGO_ATTR, stickyLogoVersion)
      }

      const options = mapPanelSettings({
        stickyEnabled: this.getElementSettings('arts_header_sticky_enabled'),
        toggleRevealEnabled: this.getElementSettings('arts_header_sticky_toggle_reveal_enabled')
      })

      this.wrapperEl.setAttribute(OPTIONS_ATTR, JSON.stringify(options))
    },

    toggleHeaderBarAttributes(this: IContainerHandler, toggle = true) {
      for (const className of [BAR_CLASS, BAR_JS_CLASS]) {
        this.el.classList.toggle(className, toggle)
      }
    },

    toggleHeaderBarSticky(this: IContainerHandler, toggle = true) {
      this.el.classList.toggle(BAR_FIXED_CLASS, toggle)
      this.el.classList.toggle(BAR_ABSOLUTE_CLASS, !toggle)
    },

    removeHeaderBarSticky(this: IContainerHandler) {
      this.el.classList.remove(BAR_FIXED_CLASS)
      this.el.classList.remove(BAR_ABSOLUTE_CLASS)
    },

    toggleWrapper(this: IContainerHandler, toggle = true) {
      if (toggle) {
        this.addWrapper()
      } else {
        this.removeWrapper()
      }
    },

    addWrapper(this: IContainerHandler) {
      const wrapper = wrapHeaderBar(this.el, this.getID())
      if (wrapper) {
        this.wrapperEl = wrapper
      }
    },

    removeWrapper(this: IContainerHandler) {
      unwrapHeaderBar(this.el)
    }
  })
}

/** Registers the container handler with Elementor's elements handler (editor mode only). */
export const attachContainerHandler = (
  onInit: TOnInitCallback,
  onDestroy: TOnDestroyCallback
): void => {
  editorGlobals().elementorFrontend?.elementsHandler?.attachHandler(
    'container',
    createContainerHandler(onInit, onDestroy),
    null
  )
}
