// @vitest-environment happy-dom
import { createContainerHandler } from '@ts/elementor/containerHandler'
import type { IContainerHandler } from '@ts/interfaces'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Elementor's Base.extend is stubbed to return the prototype object itself; the tests then run the
 * handler methods against a plain-object `this` — the engine never instanceof-checks, so a literal
 * with the right members is a legitimate handler.
 */
const stubExtend = (): void => {
  ;(window as { elementorModules?: unknown }).elementorModules = {
    frontend: { handlers: { Base: { extend: (proto: unknown) => proto } } }
  }
}

afterEach(() => {
  ;(window as { elementorModules?: unknown }).elementorModules = undefined
  document.body.innerHTML = ''
})

const makeHandler = (settings: Record<string, unknown>) => {
  stubExtend()
  const onInit = vi.fn(async () => {})
  const onDestroy = vi.fn(async () => {})
  const proto = createContainerHandler(onInit, onDestroy) as unknown as IContainerHandler
  const el = document.createElement('div')
  document.body.appendChild(el)
  const handler = Object.assign(Object.create(proto) as IContainerHandler, {
    el,
    isLoading: false,
    getElementSettings: (key: string) => settings[key],
    getID: () => 'abc123'
  })
  return { handler, el, onInit, onDestroy }
}

describe('createContainerHandler', () => {
  it('wraps the bar in the arts-header wrapper with the per-element id class', () => {
    const { handler, el } = makeHandler({ arts_header_enabled: 'yes' })
    handler.setHeader()
    const wrapper = el.parentElement
    expect(wrapper?.classList.contains('arts-header')).toBe(true)
    expect(wrapper?.classList.contains('js-arts-header')).toBe(true)
    expect(wrapper?.classList.contains('arts-header_elementor-element-abc123')).toBe(true)
    expect(el.classList.contains('arts-header__bar')).toBe(true)
    expect(el.classList.contains('js-arts-header__bar')).toBe(true)
  })

  it('reuses an existing wrapper instead of double-wrapping', () => {
    const { handler, el } = makeHandler({ arts_header_enabled: 'yes' })
    handler.setHeader()
    const wrapper = el.parentElement
    handler.setHeader()
    expect(el.parentElement).toBe(wrapper)
    expect(wrapper?.parentElement?.classList.contains('arts-header')).toBe(false)
  })

  it('unwraps and removes the wrapper when the header is disabled', () => {
    const settings: Record<string, unknown> = { arts_header_enabled: 'yes' }
    const { handler, el } = makeHandler(settings)
    handler.setHeader()
    settings.arts_header_enabled = ''
    handler.setHeader()
    expect(el.parentElement).toBe(document.body)
    expect(document.querySelector('.arts-header')).toBeNull()
  })

  it('signals the docking mode on the bar — never both modifier classes at once', () => {
    const settings: Record<string, unknown> = {
      arts_header_enabled: 'yes',
      arts_header_on_scroll: 'auto-hide'
    }
    const { handler, el } = makeHandler(settings)
    handler.setHeader()
    expect(el.classList.contains('arts-header__bar_fixed')).toBe(true)
    expect(el.classList.contains('arts-header__bar_absolute')).toBe(false)
    settings.arts_header_on_scroll = ''
    handler.setHeader()
    expect(el.classList.contains('arts-header__bar_fixed')).toBe(false)
    expect(el.classList.contains('arts-header__bar_absolute')).toBe(true)
    // Bottom dock replaces the fixed/absolute pair wholesale — a bottom bar is inherently fixed,
    // regardless of the On Scroll behavior.
    settings.arts_header_position = 'bottom'
    settings.arts_header_on_scroll = 'sticky'
    handler.setHeader()
    expect(el.classList.contains('arts-header__bar_bottom')).toBe(true)
    expect(el.classList.contains('arts-header__bar_fixed')).toBe(false)
    expect(el.classList.contains('arts-header__bar_absolute')).toBe(false)
    settings.arts_header_position = ''
    handler.setHeader()
    expect(el.classList.contains('arts-header__bar_bottom')).toBe(false)
    expect(el.classList.contains('arts-header__bar_fixed')).toBe(true)
    // Default (flow): pinning is CSS-native, so the On Scroll behavior decides the modifier —
    // sticky/auto-hide emit _sticky, None emits NO modifier at all (plain static in-page bar).
    settings.arts_header_position = 'flow'
    handler.setHeader()
    expect(el.classList.contains('arts-header__bar_sticky')).toBe(true)
    expect(el.classList.contains('arts-header__bar_fixed')).toBe(false)
    expect(el.classList.contains('arts-header__bar_bottom')).toBe(false)
    settings.arts_header_on_scroll = ''
    handler.setHeader()
    for (const cls of ['_sticky', '_sticky-bottom', '_fixed', '_absolute', '_bottom']) {
      expect(el.classList.contains(`arts-header__bar${cls}`)).toBe(false)
    }
    // Default position + Stick To bottom → the bottom-pinned flow modifier.
    settings.arts_header_on_scroll = 'sticky'
    settings.arts_header_stick_to = 'bottom'
    handler.setHeader()
    expect(el.classList.contains('arts-header__bar_sticky-bottom')).toBe(true)
    expect(el.classList.contains('arts-header__bar_sticky')).toBe(false)
    settings.arts_header_stick_to = ''
    handler.setHeader()
    expect(el.classList.contains('arts-header__bar_sticky-bottom')).toBe(false)
    expect(el.classList.contains('arts-header__bar_sticky')).toBe(true)
  })

  it('syncs the Header Zone attributes on a non-header container, and clears them on None', () => {
    const settings: Record<string, unknown> = {
      arts_header_enabled: '',
      arts_header_zone: 'hide',
      arts_header_zone_geometry: 'overlap'
    }
    const { handler, el } = makeHandler(settings)
    handler.setHeader()
    expect(el.getAttribute('data-arts-header-hide-over')).toBe('overlap')
    settings.arts_header_zone = 'lock'
    settings.arts_header_zone_geometry = 'junk'
    handler.setHeader()
    expect(el.getAttribute('data-arts-header-hide-over')).toBeNull()
    expect(el.getAttribute('data-arts-header-lock-over')).toBe('at-top')
    settings.arts_header_zone = ''
    handler.setHeader()
    expect(el.getAttribute('data-arts-header-hide-over')).toBeNull()
    expect(el.getAttribute('data-arts-header-lock-over')).toBeNull()
  })

  it('never marks a header container as its own zone', () => {
    const { handler, el } = makeHandler({
      arts_header_enabled: 'yes',
      arts_header_on_scroll: 'sticky',
      arts_header_zone: 'hide'
    })
    handler.setHeader()
    expect(el.getAttribute('data-arts-header-hide-over')).toBeNull()
  })

  it('marks the second header container as secondary in its options JSON', () => {
    const settings = { arts_header_enabled: 'yes', arts_header_on_scroll: 'sticky' }
    const first = makeHandler(settings)
    first.handler.setHeader()
    const second = makeHandler(settings)
    second.handler.setHeader()
    expect(first.el.parentElement?.getAttribute('data-arts-header-options')).toBe(
      '{"sticky":{"reveal":false}}'
    )
    expect(second.el.parentElement?.getAttribute('data-arts-header-options')).toBe(
      '{"sticky":{"reveal":false,"zones":false},"heightObserver":false}'
    )
  })

  it('serializes the mapped panel options and the logo version attributes onto the wrapper', () => {
    const { handler, el } = makeHandler({
      arts_header_enabled: 'yes',
      arts_header_on_scroll: 'auto-hide',
      arts_header_state_non_sticky_logo_version: 'primary',
      arts_header_state_sticky_logo_version: 'secondary'
    })
    handler.setHeader()
    const wrapper = el.parentElement
    expect(wrapper?.getAttribute('data-arts-header-options')).toBe('{"sticky":{"reveal":true}}')
    expect(wrapper?.getAttribute('data-arts-header-non-sticky-logo')).toBe('primary')
    expect(wrapper?.getAttribute('data-arts-header-sticky-logo')).toBe('secondary')
  })

  it('boots via onInit with the wrapper+bar pair, guarded against re-entrancy', async () => {
    const { handler, onInit } = makeHandler({ arts_header_enabled: 'yes' })
    handler.setHeader()
    const first = handler.initHeader(
      onInit,
      vi.fn(async () => {})
    )
    const second = handler.initHeader(
      onInit,
      vi.fn(async () => {})
    )
    await first
    await second
    expect(onInit).toHaveBeenCalledTimes(1)
    expect(onInit).toHaveBeenCalledWith({ container: handler.wrapperEl, bar: handler.el })
  })

  it('routes a disabled header to onDestroy instead of onInit', async () => {
    const { handler, onInit, onDestroy } = makeHandler({ arts_header_enabled: '' })
    handler.setHeader()
    Object.assign(handler, { onDestroy })
    await handler.initHeader(onInit, onDestroy)
    expect(onInit).not.toHaveBeenCalled()
    expect(onDestroy).toHaveBeenCalledTimes(1)
  })
})
