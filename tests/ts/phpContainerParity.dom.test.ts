// @vitest-environment happy-dom
import {
  ALT_LOGO_ATTR,
  NON_STICKY_LOGO_ATTR,
  OPTIONS_ATTR,
  STICKY_LOGO_ATTR,
  ZONE_ATTR,
  ZONE_LOOK_ATTR
} from '@ts/constants'
import { createContainerHandler } from '@ts/elementor/containerHandler'
import type { IContainerHandler } from '@ts/interfaces'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  fixture,
  hasPhp,
  type IRenderedElement,
  renderEach,
  type TPanelSettings
} from './phpEmitter'

/**
 * The editor renders containers client-side, so `containerHandler` mirrors what `Markup.php` prints
 * on the frontend: bar classes, zone and look markers, logo version attributes, options JSON. These
 * rows go through both and must come out identical. Settings reachable from the panel only: both
 * sides agree on every valid value, but not on unknown `arts_header_position` strings or non-string
 * versions, which no control can produce.
 */

interface IMarkupSummary {
  barClasses: string[]
  zone: string | null
  look: string | null
  wrapper: Record<string, string | null> | null
}

const rows = fixture<{
  onScroll: { name: string; settings: TPanelSettings }[]
  zones: { name: string; settings: TPanelSettings }[]
  logos: { name: string; settings: TPanelSettings }[]
}>('panel-settings.json')

const ENABLED = { arts_header_enabled: 'yes' }
const WRAPPER_ATTRS = [OPTIONS_ATTR, NON_STICKY_LOGO_ATTR, STICKY_LOGO_ATTR, ALT_LOGO_ATTR]

const positions = [undefined, '', 'flow', 'bottom']
const onScrolls = [undefined, '', 'sticky', 'auto-hide']
const stickTos = [undefined, '', 'bottom']

const barMatrix = positions.flatMap((position) =>
  onScrolls.flatMap((onScroll) =>
    stickTos.map((stickTo) => ({
      name: `bar: position ${position ?? 'unset'}, on scroll ${onScroll ?? 'unset'}, stick to ${stickTo ?? 'unset'}`,
      settings: {
        ...ENABLED,
        ...(position === undefined ? {} : { arts_header_position: position }),
        ...(onScroll === undefined ? {} : { arts_header_on_scroll: onScroll }),
        ...(stickTo === undefined ? {} : { arts_header_stick_to: stickTo })
      }
    }))
  )
)

const cases = [
  ...rows.onScroll.map((row) => ({ ...row, settings: { ...ENABLED, ...row.settings } })),
  ...barMatrix,
  ...rows.zones,
  ...rows.logos.map((row) => ({ ...row, settings: { ...ENABLED, ...row.settings } }))
]

afterEach(() => {
  ;(window as { elementorModules?: unknown }).elementorModules = undefined
  document.body.innerHTML = ''
})

/** What the editor handler leaves on the container for `settings`. */
const summarizeEditor = (settings: TPanelSettings): IMarkupSummary => {
  ;(window as { elementorModules?: unknown }).elementorModules = {
    frontend: { handlers: { Base: { extend: (proto: unknown) => proto } } }
  }
  const proto = createContainerHandler(
    vi.fn(async () => {}),
    vi.fn(async () => {})
  ) as unknown as IContainerHandler
  const el = document.createElement('div')
  document.body.appendChild(el)
  const handler = Object.assign(Object.create(proto) as IContainerHandler, {
    el,
    isLoading: false,
    getElementSettings: (key?: string) => (key === undefined ? settings : settings[key]),
    getID: () => 'abc123'
  })
  handler.setHeader()

  const wrapperEl = handler.wrapperEl
  const summary: IMarkupSummary = {
    barClasses: [...el.classList].sort(),
    zone: el.getAttribute(ZONE_ATTR),
    look: el.getAttribute(ZONE_LOOK_ATTR),
    wrapper: wrapperEl
      ? Object.fromEntries(WRAPPER_ATTRS.map((attr) => [attr, wrapperEl.getAttribute(attr)]))
      : null
  }
  document.body.innerHTML = ''
  return summary
}

/** What the frontend hooks leave on the same container, in the same shape. */
const summarizeFrontend = (element: IRenderedElement, settings: TPanelSettings): IMarkupSummary => {
  const bar = element.attributes._wrapper ?? {}
  const wrapper = element.attributes.header_wrapper
  return {
    barClasses: [...(bar.class ?? [])].sort(),
    zone: bar[ZONE_ATTR]?.[0] ?? null,
    look: bar[ZONE_LOOK_ATTR]?.[0] ?? null,
    wrapper: settings.arts_header_enabled
      ? Object.fromEntries(WRAPPER_ATTRS.map((attr) => [attr, wrapper?.[attr]?.[0] ?? null]))
      : null
  }
}

describe.skipIf(!hasPhp)('containerHandler mirrors Markup.php', () => {
  let frontend: IRenderedElement[] = []

  beforeAll(() => {
    frontend = renderEach(cases.map((entry) => entry.settings))
  })

  it.each(cases.map((entry, index) => ({ ...entry, index })))('$name', ({ settings, index }) => {
    const element = frontend[index]
    if (!element) {
      throw new Error('missing PHP result')
    }

    expect(summarizeEditor(settings)).toEqual(summarizeFrontend(element, settings))
  })
})
