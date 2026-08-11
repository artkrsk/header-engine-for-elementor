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

/**
 * Editor-only container handler: wraps an Elementor Container in the `.arts-header` div, syncs
 * panel settings into `data-arts-header-*` attributes on every change, and re-inits/destroys the
 * live header instance.
 */
export const createContainerHandler = (onInit: TOnInitCallback, onDestroy: TOnDestroyCallback) => {
  return window?.elementorModules?.frontend?.handlers.Base.extend({
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
      if (!this.el.parentNode) {
        return
      }

      // Reuse an existing wrapper — match removeWrapper's identification exactly.
      if (
        this.el.parentElement?.classList.contains(WRAPPER_CLASS) &&
        this.el.parentElement.classList.contains(WRAPPER_JS_CLASS)
      ) {
        this.wrapperEl = this.el.parentElement
        return
      }

      const wrapper = document.createElement('div')
      const classNameWithId = `${WRAPPER_ELEMENT_ID_PREFIX}${this.getID()}`
      wrapper.classList.add(WRAPPER_CLASS, classNameWithId, WRAPPER_JS_CLASS)

      this.el.parentNode.insertBefore(wrapper, this.el)
      wrapper.appendChild(this.el)
      this.wrapperEl = wrapper
    },

    removeWrapper(this: IContainerHandler) {
      const parentElement = this.el.parentElement

      if (
        !parentElement?.classList.contains(WRAPPER_CLASS) ||
        !parentElement.classList.contains(WRAPPER_JS_CLASS) ||
        !parentElement.parentNode
      ) {
        return
      }

      const grandParent = parentElement.parentNode
      grandParent.insertBefore(this.el, parentElement)

      // Remove the wrapper only if it ends up empty.
      if (parentElement.children.length === 0) {
        parentElement.remove()
      }
    }
  })
}

/** Registers the container handler with Elementor's elements handler (editor mode only). */
export const attachContainerHandler = (
  onInit: TOnInitCallback,
  onDestroy: TOnDestroyCallback
): void => {
  window.elementorFrontend?.elementsHandler?.attachHandler(
    'container',
    createContainerHandler(onInit, onDestroy),
    null
  )
}
