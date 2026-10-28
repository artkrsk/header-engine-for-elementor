import { describe, expect, it } from 'vitest'
import { hasPhp, lazyEmitter } from './phpEmitter'

/**
 * Assets (the editor flag the bundle reads) and Plugin (the load-order race guard and the hook
 * table) run against the WordPress shims in `tests/php/bootstrap.php`.
 */

interface IRecordedCall {
  fn: string
  args: unknown[]
}

interface IHookRow {
  hook: string
  callback: string
  priority: number
  accepted_args: number
  callable: boolean
  args_ok: boolean
}

interface IPluginResult {
  construct: IHookRow[]
  afterLoaded: IHookRow[] | null
  singleton: boolean
}

const HANDLE = 'artem-semkin-header-engine-for-elementor'
const LIBRARY = `/src/php/libraries/${HANDLE}/${HANDLE}`

type TElementorState = 'no-instance' | 'no-preview' | 'preview-off' | 'preview-on'

describe.skipIf(!hasPhp)('Assets', () => {
  const states: TElementorState[] = ['preview-on', 'preview-off', 'no-preview', 'no-instance']
  const emitted = lazyEmitter<{ calls: IRecordedCall[] }>(
    'assets.php',
    states.map((elementor) => ({ elementor }))
  )
  const bare = lazyEmitter<{ calls: IRecordedCall[] }>(
    'assets.php',
    [{ elementor: 'preview-on' }],
    ['--bare']
  )

  const callsOf = (state: TElementorState): IRecordedCall[] =>
    emitted()[states.indexOf(state)]?.calls ?? []

  const find = (calls: IRecordedCall[], fn: string): IRecordedCall | undefined =>
    calls.find((call) => call.fn === fn)

  /** The `window.artsHeaderOptions = {...};` assignment, parsed. */
  const optionsOf = (calls: IRecordedCall[]): unknown => {
    const source = String(find(calls, 'wp_add_inline_script')?.args[1])
    return JSON.parse(source.replace(/^window\.artsHeaderOptions = /, '').replace(/;$/, ''))
  }

  it('registers the stylesheet and a deferred footer script under one handle', () => {
    const calls = callsOf('preview-off')

    expect(find(calls, 'wp_register_style')?.args).toEqual([
      HANDLE,
      `https://example.test/wp-content/plugins/${HANDLE}${LIBRARY}.css`,
      ['elementor-frontend'],
      '9.9.9'
    ])
    expect(find(calls, 'wp_register_script')?.args).toEqual([
      HANDLE,
      `https://example.test/wp-content/plugins/${HANDLE}${LIBRARY}.js`,
      [],
      '9.9.9',
      { in_footer: true, strategy: 'defer' }
    ])
  })

  it('enqueues both under that handle', () => {
    expect(
      callsOf('preview-off')
        .filter((call) => call.fn.startsWith('wp_enqueue_'))
        .map((call) => [call.fn, call.args])
    ).toEqual([
      ['wp_enqueue_style', [HANDLE]],
      ['wp_enqueue_script', [HANDLE]]
    ])
  })

  it('prints isElementorEditor as a real boolean ahead of the bundle', () => {
    for (const [state, expected] of [
      ['preview-on', true],
      ['preview-off', false],
      ['no-preview', false],
      ['no-instance', false]
    ] as const) {
      const inline = find(callsOf(state), 'wp_add_inline_script')

      expect(inline?.args[0]).toBe(HANDLE)
      expect(inline?.args[1]).toBe(`window.artsHeaderOptions = {"isElementorEditor":${expected}};`)
      expect(inline?.args[2]).toBe('before')
      expect(optionsOf(callsOf(state))).toStrictEqual({ isElementorEditor: expected })
    }
  })

  it('adds the editor canvas compensation CSS in preview mode only, after the style exists', () => {
    const calls = callsOf('preview-on')
    const index = (fn: string) => calls.findIndex((call) => call.fn === fn)

    expect(index('wp_add_inline_style')).toBeGreaterThan(index('wp_register_style'))
    expect(find(calls, 'wp_add_inline_style')?.args[0]).toBe(HANDLE)
    expect(String(find(calls, 'wp_add_inline_style')?.args[1])).toContain(
      'body.elementor-editor-active .elementor-location-header #elementor-add-new-section'
    )
    for (const state of ['preview-off', 'no-preview', 'no-instance'] as const) {
      expect(find(callsOf(state), 'wp_add_inline_style')).toBeUndefined()
    }
  })

  it('reports no editor when Elementor is not installed at all', () => {
    const [result] = bare()

    expect(optionsOf(result?.calls ?? [])).toStrictEqual({ isElementorEditor: false })
    expect(find(result?.calls ?? [], 'wp_add_inline_style')).toBeUndefined()
  })
})

describe.skipIf(!hasPhp)('Plugin bootstrap', () => {
  const emitted = lazyEmitter<IPluginResult>('plugin.php', [
    { didAction: 1 },
    { didAction: 2 },
    { didAction: 0 }
  ])
  const loaded = () => emitted()[0]
  const loadedAgain = () => emitted()[1]
  const early = () => emitted()[2]

  it('wires everything immediately when elementor/loaded already fired', () => {
    for (const result of [loaded(), loadedAgain()]) {
      expect(result?.afterLoaded).toBeNull()
      expect(result?.construct.some((row) => row.hook === 'elementor/loaded')).toBe(false)
      expect(result?.construct.length).toBeGreaterThan(10)
    }
  })

  it('defers to elementor/loaded when it has not fired, then wires the same hooks', () => {
    expect(early()?.construct).toEqual([
      {
        hook: 'elementor/loaded',
        callback: 'Plugin::init_elementor',
        priority: 10,
        accepted_args: 1,
        callable: true,
        args_ok: true
      }
    ])
    expect(early()?.afterLoaded).toEqual(loaded()?.construct)
  })

  it('is a singleton that never wires twice', () => {
    expect(loaded()?.singleton).toBe(true)
    expect(early()?.singleton).toBe(true)
  })

  it('registers only callable callbacks that accept every parameter they require', () => {
    const broken = (loaded()?.construct ?? []).filter((row) => !row.callable || !row.args_ok)

    expect(broken).toEqual([])
  })

  it('pins the hooks the Backend sync and Elementor controls depend on', () => {
    const hooks = (loaded()?.construct ?? []).map(
      (row) => `${row.hook} ${row.callback} ${row.priority} ${row.accepted_args}`
    )

    expect(hooks).toEqual(
      expect.arrayContaining([
        'elementor/document/before_save Backend::update_theme_mods_on_site_settings_save 10 2',
        'pre_set_theme_mod_custom_logo Backend::handle_custom_logo_theme_mod 10 2',
        'pre_set_theme_mod_arts_header_custom_logo_secondary Backend::handle_secondary_logo_theme_mod 10 2',
        'pre_update_option_site_icon Backend::handle_favicon_option 10 3',
        'elementor/element/container/section_layout_container/after_section_end Controls::add_header_section_controls 10 1',
        'elementor/element/container/section_layout_container/after_section_end Controls::add_header_zone_section_controls 11 1'
      ])
    )
  })
})
