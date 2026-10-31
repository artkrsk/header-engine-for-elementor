// @vitest-environment happy-dom
import {
  ALT_LOGO_ATTR,
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
  ZONE_ATTR,
  ZONE_LOOK_ATTR
} from '@ts/constants'
import { mapPanelSettings } from '@ts/elementor/mapPanelSettings'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fixture,
  hasPhp,
  type IRenderedElement,
  renderEach,
  renderElements,
  runEmitter,
  type TPanelSettings
} from './phpEmitter'

/**
 * The frontend writes the options JSON in PHP, the editor writes it in TS; both feed one engine.
 * These suites push the same panel rows through both and compare the emitted strings, so `[]` vs
 * `{}`, key order and `false` vs `""` drift cannot hide behind substring checks. The PHP side runs
 * as `tests/php/*.php` emitters (see `phpEmitter.ts`).
 */

interface IOnScrollRow {
  name: string
  settings: TPanelSettings
  primary: string
  secondary: string
}

interface IZoneRow {
  name: string
  settings: TPanelSettings
  zone: string | null
  look: string | null
}

interface ILogoRow {
  name: string
  settings: TPanelSettings
  attributes: Record<string, string>
}

const rows = fixture<{ onScroll: IOnScrollRow[]; zones: IZoneRow[]; logos: ILogoRow[] }>(
  'panel-settings.json'
)

const ENABLED = { arts_header_enabled: 'yes' }

const lazy = <T>(compute: () => T): (() => T) => {
  let value: T | undefined
  return () => {
    value ??= compute()
    return value
  }
}

const wrapperAttr = (element: IRenderedElement | undefined, name: string): string | undefined =>
  element?.attributes.header_wrapper?.[name]?.[0]

const barAttr = (element: IRenderedElement | undefined, name: string): string | undefined =>
  element?.attributes._wrapper?.[name]?.[0]

describe.skipIf(!hasPhp)('mapPanelSettings parity with Markup::map_panel_settings', () => {
  const stringRows = rows.onScroll.filter(
    (row) => typeof row.settings.arts_header_on_scroll === 'string'
  )

  const direct = lazy(() =>
    runEmitter<{ json: string }>(
      'markup.php',
      stringRows.flatMap((row) =>
        [true, false].map((isPrimary) => ({
          op: 'map',
          onScroll: row.settings.arts_header_on_scroll,
          isPrimary
        }))
      )
    ).map((result) => result.json)
  )

  const rendered = lazy(() =>
    runEmitter<{ elements: IRenderedElement[] }>(
      'markup.php',
      rows.onScroll.map((row) => ({
        op: 'render',
        elements: ['a', 'b'].map((id) => ({
          id,
          type: 'container',
          settings: { ...ENABLED, ...row.settings }
        }))
      }))
    )
  )

  it.each(stringRows)('$name: the static mapper matches the TS mapper and the fixture', (row) => {
    const index = stringRows.indexOf(row) * 2
    const onScroll = row.settings.arts_header_on_scroll

    expect(direct()[index]).toBe(row.primary)
    expect(direct()[index + 1]).toBe(row.secondary)
    expect(JSON.stringify(mapPanelSettings({ onScroll, isPrimary: true }))).toBe(row.primary)
    expect(JSON.stringify(mapPanelSettings({ onScroll, isPrimary: false }))).toBe(row.secondary)
  })

  it.each(rows.onScroll)('$name: the emitted options attribute matches', (row) => {
    const index = rows.onScroll.indexOf(row)
    const [primary, secondary] = rendered()[index]?.elements ?? []
    const onScroll = row.settings.arts_header_on_scroll

    // A value that is not a string reads as "no behavior" on both sides.
    expect(wrapperAttr(primary, OPTIONS_ATTR)).toBe(row.primary)
    expect(wrapperAttr(secondary, OPTIONS_ATTR)).toBe(row.secondary)
    expect(wrapperAttr(primary, OPTIONS_ATTR)).toBe(
      JSON.stringify(mapPanelSettings({ onScroll, isPrimary: true }))
    )
    expect(wrapperAttr(secondary, OPTIONS_ATTR)).toBe(
      JSON.stringify(mapPanelSettings({ onScroll, isPrimary: false }))
    )
  })
})

describe.skipIf(!hasPhp)('Markup primary / secondary classification', () => {
  const settings = { ...ENABLED, arts_header_on_scroll: 'auto-hide' }
  const primary = '{"sticky":{"reveal":true}}'
  const secondary = '{"sticky":{"reveal":true,"zones":false},"heightObserver":false}'

  it('keys the primary on the first rendered id and keeps it across a re-render', () => {
    const out = renderElements(
      ['a', 'b', 'a', 'c'].map((id) => ({ id, type: 'container' as const, settings }))
    )

    expect(out.map((element) => wrapperAttr(element, OPTIONS_ATTR))).toEqual([
      primary,
      secondary,
      primary,
      secondary
    ])
  })

  it('seeds the page-global height script after the primary header only', () => {
    const out = renderElements(
      ['a', 'b', 'a'].map((id) => ({ id, type: 'container' as const, settings }))
    )

    expect(
      out.map((element) => element.after.includes('<script id="arts-header-height-a-js">'))
    ).toEqual([true, false, true])
    expect(out.some((element) => element.after.includes('arts-header-height-b-js'))).toBe(false)
    expect(out.every((element) => element.after.includes('</div></div>'))).toBe(true)
  })

  it('never lets a widget or a disabled container claim the primary slot', () => {
    const [widget, plain, header] = renderElements([
      { id: 'w', type: 'widget', settings },
      { id: 'n', type: 'container', settings: {} },
      { id: 'a', type: 'container', settings }
    ])

    expect(widget).toMatchObject({ attributes: {}, before: '', after: '' })
    expect(plain).toMatchObject({ attributes: {}, before: '', after: '' })
    expect(wrapperAttr(header, OPTIONS_ATTR)).toBe(primary)
  })

  it.each([
    ['empty string', ''],
    ['"0"', '0'],
    ['0', 0],
    ['null', null],
    ['false', false],
    ['empty array', []]
  ])('treats an empty enabled switch (%s) as not a header', (_label, value) => {
    const [element] = renderEach([{ arts_header_enabled: value, arts_header_on_scroll: 'sticky' }])

    expect(element).toMatchObject({ attributes: {}, before: '', after: '' })
  })

  it('wraps the bar in the value host and the wrapper, scoped by element id', () => {
    const [element] = renderEach([ENABLED])

    expect(element?.attributes.header_wrapper?.class).toEqual([
      'arts-header',
      'arts-header_elementor-element-abc123',
      'js-arts-header'
    ])
    expect(element?.attributes.header_values?.class).toEqual([
      'arts-header-values',
      'arts-header-values_elementor-element-abc123',
      'js-arts-header-values'
    ])
  })
})

describe.skipIf(!hasPhp)('Markup bar modifier classes', () => {
  const positions = [undefined, '', 'flow', 'bottom']
  const onScrolls = [undefined, '', 'sticky', 'auto-hide', 'bounce']
  const stickTos = [undefined, '', 'bottom']

  /** The mode table from CLAUDE.md: the wrapper positions, the bar modifier only signals. */
  const expectedModifier = (
    position: string | undefined,
    onScroll: string | undefined,
    stickTo: string | undefined
  ): string | null => {
    const machineryOn = onScroll === 'sticky' || onScroll === 'auto-hide'
    if (position === 'bottom') {
      return BAR_BOTTOM_CLASS
    }
    if (position === 'flow') {
      if (!machineryOn) {
        return null
      }
      return stickTo === 'bottom' ? BAR_STICKY_BOTTOM_CLASS : BAR_STICKY_CLASS
    }
    return machineryOn ? BAR_FIXED_CLASS : BAR_ABSOLUTE_CLASS
  }

  const cases = positions.flatMap((position) =>
    onScrolls.flatMap((onScroll) =>
      stickTos.map((stickTo) => ({
        position,
        onScroll,
        stickTo,
        settings: {
          ...ENABLED,
          ...(position === undefined ? {} : { arts_header_position: position }),
          ...(onScroll === undefined ? {} : { arts_header_on_scroll: onScroll }),
          ...(stickTo === undefined ? {} : { arts_header_stick_to: stickTo })
        }
      }))
    )
  )

  const rendered = lazy(() => renderEach(cases.map((entry) => entry.settings)))

  it('covers the whole position x on-scroll x stick-to matrix', () => {
    const failures = cases.flatMap((entry, index) => {
      const modifier = expectedModifier(entry.position, entry.onScroll, entry.stickTo)
      const expected = [BAR_CLASS, BAR_JS_CLASS, ...(modifier ? [modifier] : [])]
      const actual = rendered()[index]?.attributes._wrapper?.class
      return JSON.stringify(actual) === JSON.stringify(expected)
        ? []
        : [`${JSON.stringify(entry.settings)} -> ${JSON.stringify(actual)}`]
    })

    expect(failures).toEqual([])
  })

  it('pins the headline rows so the oracle cannot drift with the implementation', () => {
    const modifierOf = (settings: TPanelSettings): string | undefined => {
      const [element] = renderEach([{ ...ENABLED, ...settings }])
      return element?.attributes._wrapper?.class?.[2]
    }

    expect(modifierOf({ arts_header_position: 'bottom' })).toBe('arts-header__bar_bottom')
    expect(modifierOf({ arts_header_position: 'bottom', arts_header_on_scroll: 'sticky' })).toBe(
      'arts-header__bar_bottom'
    )
    expect(modifierOf({ arts_header_position: 'flow', arts_header_on_scroll: '' })).toBeUndefined()
    expect(
      modifierOf({
        arts_header_position: 'flow',
        arts_header_on_scroll: 'sticky',
        arts_header_stick_to: 'bottom'
      })
    ).toBe('arts-header__bar_sticky-bottom')
    expect(modifierOf({ arts_header_position: '', arts_header_on_scroll: 'auto-hide' })).toBe(
      'arts-header__bar_fixed'
    )
    expect(modifierOf({ arts_header_position: '', arts_header_on_scroll: '' })).toBe(
      'arts-header__bar_absolute'
    )
  })

  it('leaves a disabled header container without any bar class', () => {
    const [element] = renderEach([
      { arts_header_position: 'bottom', arts_header_on_scroll: 'sticky' }
    ])

    expect(element?.attributes._wrapper).toBeUndefined()
  })
})

describe.skipIf(!hasPhp)('Markup zone and look markers', () => {
  const rendered = lazy(() => renderEach(rows.zones.map((row) => row.settings)))

  it.each(rows.zones)('$name', (row) => {
    const element = rendered()[rows.zones.indexOf(row)]

    expect(barAttr(element, ZONE_ATTR) ?? null).toBe(row.zone)
    expect(barAttr(element, ZONE_LOOK_ATTR) ?? null).toBe(row.look)
  })

  it('does not mark a widget', () => {
    const [element] = renderEach([{ arts_header_zone: 'hide' }], 'widget')

    expect(element?.attributes).toEqual({})
  })
})

describe.skipIf(!hasPhp)('Markup logo version attributes', () => {
  const rendered = lazy(() =>
    renderEach(rows.logos.map((row) => ({ ...ENABLED, ...row.settings })))
  )
  const LOGO_ATTRS = [NON_STICKY_LOGO_ATTR, STICKY_LOGO_ATTR, ALT_LOGO_ATTR]

  it.each(rows.logos)('$name', (row) => {
    const element = rendered()[rows.logos.indexOf(row)]
    const written = Object.fromEntries(
      LOGO_ATTRS.flatMap((attr) => {
        const value = wrapperAttr(element, attr)
        return value === undefined ? [] : [[attr, value]]
      })
    )

    expect(written).toEqual(row.attributes)
  })

  it('writes only non-empty strings', () => {
    const [element] = renderEach([
      {
        ...ENABLED,
        arts_header_state_non_sticky_logo_version: 5,
        arts_header_state_sticky_logo_version: true,
        arts_header_state_alt_logo_version: ['secondary']
      }
    ])

    expect(LOGO_ATTRS.map((attr) => wrapperAttr(element, attr))).toEqual([
      undefined,
      undefined,
      undefined
    ])
  })
})

describe.skipIf(!hasPhp)('Markup pre-paint height seed', () => {
  const root = (): HTMLElement => document.documentElement
  const STICKY_VAR = '--arts-header-height-sticky'
  const NON_STICKY_VAR = '--arts-header-height-non-sticky'
  const CLEARANCE_VAR = '--arts-header-clearance-non-sticky'

  /** The seed script's body as PHP prints it after the primary header. */
  const renderSeed = (): string => {
    const [header] = renderElements([{ id: 'a', type: 'container', settings: ENABLED }])
    const match = /<script id="arts-header-height-a-js">([\s\S]*?)<\/script>/.exec(
      header?.after ?? ''
    )
    expect(match).not.toBeNull()
    return match?.[1] ?? ''
  }

  const sizeBar = (bar: HTMLElement, height: number): void => {
    Object.defineProperty(bar, 'clientHeight', { value: height, configurable: true })
    bar.getBoundingClientRect = () => ({ top: 0, bottom: height, height }) as DOMRect
  }

  const build = (height: number): HTMLElement => {
    const wrapper = document.createElement('div')
    wrapper.className = 'arts-header arts-header_elementor-element-a js-arts-header'
    const bar = document.createElement('div')
    bar.className = 'arts-header__bar js-arts-header__bar'
    sizeBar(bar, height)
    wrapper.appendChild(bar)
    document.body.appendChild(wrapper)
    return bar
  }

  afterEach(() => {
    document.body.innerHTML = ''
    root().style.removeProperty(STICKY_VAR)
    root().style.removeProperty(NON_STICKY_VAR)
    root().style.removeProperty(CLEARANCE_VAR)
    root().classList.remove('has-header-height')
  })

  it('writes the rest pair and the class on <html>, and no sticky or live height', () => {
    const seed = renderSeed()
    build(80)
    new Function(seed)()
    expect(root().style.getPropertyValue(NON_STICKY_VAR)).toBe('80px')
    expect(root().style.getPropertyValue(CLEARANCE_VAR)).toBe('80px')
    expect(root().classList.contains('has-header-height')).toBe(true)
    expect(root().style.getPropertyValue(STICKY_VAR)).toBe('')
    expect(root().style.getPropertyValue('--arts-header-height')).toBe('')
  })

  // The navigator re-runs the seed at every AJAX header swap: an unchanged header must not
  // touch the inline style (an inherited var written on <html> re-resolves the whole page).
  it('skips every write whose value is already inline, like the engine does', () => {
    const seed = renderSeed()
    const bar = build(80)
    new Function(seed)()
    const rootWrites = vi.spyOn(root().style, 'setProperty')
    new Function(seed)()
    expect(rootWrites).not.toHaveBeenCalled()
    sizeBar(bar, 64)
    new Function(seed)()
    expect(rootWrites).toHaveBeenCalledTimes(2)
    expect(rootWrites).toHaveBeenCalledWith(NON_STICKY_VAR, '64px')
    expect(rootWrites).toHaveBeenCalledWith(CLEARANCE_VAR, '64px')
  })
})
