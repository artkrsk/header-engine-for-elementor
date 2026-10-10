import type { ElementorFrontend, ElementorModules } from '@artemsemkin/elementor-types'
import {
  BAR_ABSOLUTE_CLASS,
  BAR_BOTTOM_CLASS,
  BAR_CLASS,
  BAR_FIXED_CLASS,
  BAR_JS_CLASS,
  BAR_STICKY_BOTTOM_CLASS,
  BAR_STICKY_CLASS,
  NON_STICKY_LOGO_ATTR,
  OPTIONS_ATTR,
  STICKY_LOGO_ATTR,
  VALUE_HOST_CLASS,
  VALUE_HOST_ELEMENT_ID_PREFIX,
  VALUE_HOST_JS_CLASS,
  WRAPPER_CLASS,
  WRAPPER_ELEMENT_ID_PREFIX,
  WRAPPER_JS_CLASS,
  ZONE_ATTR
} from '../constants'
import type { IContainerHandler } from '../interfaces'
import type { TOnDestroyCallback, TOnInitCallback } from '../types'
import { mapPanelSettings } from './mapPanelSettings'

/** `arts_header_zone` plus its per-breakpoint twins, but not `arts_header_zone_geometry*`. */
const ZONE_KEY_PATTERN = /^arts_header_zone(?:_(?!geometry)\w+)?$/

/** Wrap `el` in the header wrapper div, or adopt an existing one; identification matches unwrap. */
const wrapHeaderBar = (el: HTMLElement, elementId: string | number): HTMLElement | null => {
  if (!el.parentNode) {
    return null
  }
  let wrapper: HTMLElement
  if (
    el.parentElement?.classList.contains(WRAPPER_CLASS) &&
    el.parentElement.classList.contains(WRAPPER_JS_CLASS)
  ) {
    wrapper = el.parentElement
  } else {
    wrapper = el.ownerDocument.createElement('div')
    wrapper.classList.add(
      WRAPPER_CLASS,
      `${WRAPPER_ELEMENT_ID_PREFIX}${elementId}`,
      WRAPPER_JS_CLASS
    )
    el.parentNode.insertBefore(wrapper, el)
    wrapper.appendChild(el)
  }
  if (!wrapper.parentElement?.classList.contains(VALUE_HOST_JS_CLASS)) {
    const host = el.ownerDocument.createElement('div')
    host.classList.add(
      VALUE_HOST_CLASS,
      `${VALUE_HOST_ELEMENT_ID_PREFIX}${elementId}`,
      VALUE_HOST_JS_CLASS
    )
    wrapper.parentNode?.insertBefore(host, wrapper)
    host.appendChild(wrapper)
  }
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
  const host = parentElement.parentElement?.classList.contains(VALUE_HOST_JS_CLASS)
    ? parentElement.parentElement
    : null
  const outer = host ?? parentElement
  outer.parentNode?.insertBefore(el, outer)
  if (parentElement.children.length === 0) {
    parentElement.remove()
  }
  if (host?.children.length === 0) {
    host.remove()
  }
}

/**
 * The editor globals this module reaches, typed via the package as a plain
 * Window intersection (not ambient) so consumers compiling this source with
 * their own configs still resolve the types through the module graph.
 */
type TElementorEditorGlobals = Window & {
  elementorModules?: ElementorModules
  elementorFrontend?: ElementorFrontend
}

const editorGlobals = (): Partial<TElementorEditorGlobals> =>
  typeof window === 'undefined' ? {} : (window as TElementorEditorGlobals)

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
    // editor, so PHP never gets to print the marker there. Kind and geometry are responsive CSS
    // vars the zone tracker resolves at scan time; the marker flips when ANY breakpoint opts in.
    setZoneAttributes(this: IContainerHandler, headerEnabled: boolean) {
      const isZone =
        !headerEnabled &&
        Object.entries(this.getElementSettings() ?? {}).some(
          ([key, value]) => ZONE_KEY_PATTERN.test(key) && (value === 'hide' || value === 'lock')
        )
      // Always a remove + set, never a no-op toggle: the attribute mutation is what makes the
      // zones observer rescan after a kind/geometry var change.
      this.el.removeAttribute(ZONE_ATTR)
      if (isZone) {
        // Value = the desktop `kind:geometry`, the tracker's fallback for a var not yet written.
        const kind = this.getElementSettings('arts_header_zone')
        this.el.setAttribute(
          ZONE_ATTR,
          `${kind === 'hide' || kind === 'lock' ? kind : ''}:${this.getElementSettings('arts_header_zone_geometry') ?? ''}`
        )
      }
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
