import {
  BAR_ABSOLUTE_CLASS,
  BAR_BOTTOM_CLASS,
  BAR_CLASS,
  BAR_FIXED_CLASS,
  BAR_JS_CLASS,
  BAR_STICKY_BOTTOM_CLASS,
  BAR_STICKY_CLASS,
  HIDE_ZONE_ATTR,
  LOCK_ZONE_ATTR,
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

    // Safe no-op placeholder: the disabled branch of initHeader() calls this on a container
    // that never booted. The real teardown needs the wrapper, so it is swapped in below.
    onDestroy(this: IContainerHandler) {},

    setHeader(this: IContainerHandler) {
      const enabled = !!this.getElementSettings('arts_header_enabled')

      this.toggleHeaderBarAttributes(enabled)
      this.toggleWrapper(enabled)
      this.setHeaderOptions()
      this.setZoneAttributes(enabled)

      if (enabled) {
        const onScroll = this.getElementSettings('arts_header_on_scroll')
        const machineryOn = onScroll === 'sticky' || onScroll === 'auto-hide'
        const position = String(this.getElementSettings('arts_header_position') ?? '')
        const stickToBottom = this.getElementSettings('arts_header_stick_to') === 'bottom'
        this.toggleHeaderBarMode(machineryOn, position, stickToBottom)
      } else {
        this.removeHeaderBarMode()
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
            onDestroy: () => onDestroy(this.wrapperEl ?? null)
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
        onScroll: this.getElementSettings('arts_header_on_scroll'),
        // Primary = first header wrapper in DOM order; secondaries stay off the page globals.
        isPrimary: document.querySelector(`.${WRAPPER_JS_CLASS}`) === this.wrapperEl
      })

      this.wrapperEl.setAttribute(OPTIONS_ATTR, JSON.stringify(options))
    },

    // The editor mirror of Markup::add_zone_attributes — containers render client-side in the
    // editor, so PHP never gets to print the zone attribute there. The zones MutationObserver
    // picks the change up; no engine involvement needed.
    setZoneAttributes(this: IContainerHandler, headerEnabled: boolean) {
      this.el.removeAttribute(HIDE_ZONE_ATTR)
      this.el.removeAttribute(LOCK_ZONE_ATTR)
      if (headerEnabled) {
        return
      }
      const zone = this.getElementSettings('arts_header_zone')
      if (zone !== 'hide' && zone !== 'lock') {
        return
      }
      const geometryRaw = this.getElementSettings('arts_header_zone_geometry')
      const geometry =
        geometryRaw === 'overlap' || geometryRaw === 'in-view' ? geometryRaw : 'at-top'
      this.el.setAttribute(zone === 'hide' ? HIDE_ZONE_ATTR : LOCK_ZONE_ATTR, geometry)
    },

    toggleHeaderBarAttributes(this: IContainerHandler, toggle = true) {
      for (const className of [BAR_CLASS, BAR_JS_CLASS]) {
        this.el.classList.toggle(className, toggle)
      }
    },

    // Bottom is inherently fixed (On Scroll only governs the state machinery). Default (flow)
    // pins via CSS-native position:sticky, so there the behavior decides the modifier — None
    // emits no modifier at all (plain static in-page bar), and Stick To picks the pin edge.
    toggleHeaderBarMode(
      this: IContainerHandler,
      machineryOn: boolean,
      position: string,
      stickToBottom: boolean
    ) {
      const flowOn = position === 'flow' && machineryOn
      this.el.classList.toggle(BAR_BOTTOM_CLASS, position === 'bottom')
      this.el.classList.toggle(BAR_STICKY_CLASS, flowOn && !stickToBottom)
      this.el.classList.toggle(BAR_STICKY_BOTTOM_CLASS, flowOn && stickToBottom)
      this.el.classList.toggle(BAR_FIXED_CLASS, position === '' && machineryOn)
      this.el.classList.toggle(BAR_ABSOLUTE_CLASS, position === '' && !machineryOn)
    },

    removeHeaderBarMode(this: IContainerHandler) {
      this.el.classList.remove(
        BAR_BOTTOM_CLASS,
        BAR_STICKY_CLASS,
        BAR_STICKY_BOTTOM_CLASS,
        BAR_FIXED_CLASS,
        BAR_ABSOLUTE_CLASS
      )
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
