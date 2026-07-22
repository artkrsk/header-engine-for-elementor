import type { IContainerHandler } from '../interfaces'
import type { TOnDestroyCallback, TOnInitCallback } from '../types'

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

        this.setHeaderBarLogo()
        this.toggleHeaderBarSticky(stickyEnabled)
      } else {
        this.removeHeaderBarSticky()
        this.removeHeaderBarLogo()
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
            container: this.wrapperEl,
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

      const stickyEnabled = !!this.getElementSettings('arts_header_sticky_enabled')
      const stickyToggleRevealEnabled = !!this.getElementSettings(
        'arts_header_sticky_toggle_reveal_enabled'
      )
      const nonStickyLogoVersion = this.getElementSettings(
        'arts_header_state_non_sticky_logo_version'
      )
      const stickyLogoVersion = this.getElementSettings('arts_header_state_sticky_logo_version')
      const toggleAttributes: boolean | object = false

      if (nonStickyLogoVersion) {
        this.wrapperEl.setAttribute('data-arts-header-non-sticky-logo', nonStickyLogoVersion)
      }

      if (stickyLogoVersion) {
        this.wrapperEl.setAttribute('data-arts-header-sticky-logo', stickyLogoVersion)
      }

      const options = {
        sticky: {
          enabled: !!stickyEnabled,
          toggleReveal: !!(stickyEnabled && stickyToggleRevealEnabled),
          toggleAttributes
        }
      }

      this.wrapperEl.setAttribute('data-arts-header-options', JSON.stringify(options))
    },

    setHeaderBarLogo(this: IContainerHandler) {
      const nonStickyLogoVersion = this.getElementSettings(
        'arts_header_state_non_sticky_logo_version'
      )

      if (nonStickyLogoVersion) {
        this.wrapperEl?.setAttribute('data-arts-header-logo', nonStickyLogoVersion)
      } else {
        this.removeHeaderBarLogo()
      }
    },

    removeHeaderBarLogo(this: IContainerHandler) {
      this.wrapperEl?.removeAttribute('data-arts-header-logo')
    },

    toggleHeaderBarAttributes(this: IContainerHandler, toggle = true) {
      const classNames = ['arts-header__bar', 'js-arts-header__bar']

      classNames.forEach((className) => {
        this.el.classList.toggle(className, toggle)
      })
    },

    toggleHeaderBarSticky(this: IContainerHandler, toggle = true) {
      this.el.classList.toggle('arts-header__bar_fixed', toggle)
      this.el.classList.toggle('arts-header__bar_absolute', !toggle)
    },

    removeHeaderBarSticky(this: IContainerHandler) {
      this.el.classList.remove('arts-header__bar_fixed')
      this.el.classList.remove('arts-header__bar_absolute')
    },

    toggleWrapper(this: IContainerHandler, toggle = true) {
      if (toggle) {
        this.addWrapper()
      } else {
        this.removeWrapper()
      }
    },

    addWrapper(this: IContainerHandler) {
      // Check if element has a parent node
      if (!this.el.parentNode) {
        return
      }

      // Check if wrapper already exists - be more specific to match removeWrapper logic
      if (
        this.el.parentElement?.classList.contains('arts-header') &&
        this.el.parentElement.classList.contains('js-arts-header')
      ) {
        this.wrapperEl = this.el.parentElement
        return
      }

      // Create wrapper div
      const wrapper = document.createElement('div')
      const ID = this.getID()
      const classNameWithId = `arts-header_elementor-element-${ID}`
      wrapper.classList.add('arts-header', classNameWithId, 'js-arts-header')

      // Insert wrapper before the element and move element inside
      this.el.parentNode.insertBefore(wrapper, this.el)
      wrapper.appendChild(this.el)
      this.wrapperEl = wrapper
    },

    removeWrapper(this: IContainerHandler) {
      const parentElement = this.el.parentElement

      // Check if the direct parent is our arts-header wrapper
      if (
        !parentElement?.classList.contains('arts-header') ||
        !parentElement.classList.contains('js-arts-header') ||
        !parentElement.parentNode
      ) {
        return
      }

      // Store reference to the wrapper's parent
      const grandParent = parentElement.parentNode

      // Move element out of wrapper back to its grandparent
      grandParent.insertBefore(this.el, parentElement)

      // Remove the wrapper only if it's empty
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
