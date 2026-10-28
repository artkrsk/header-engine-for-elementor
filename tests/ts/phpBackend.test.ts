import { describe, expect, it } from 'vitest'
import { hasPhp, lazyEmitter } from './phpEmitter'

/**
 * Backend keeps the kit's Site Identity and the WordPress theme mods in step. The emitter fakes
 * the WordPress setters and the kit manager and reports every call (`tests/php/backend.php`).
 */

interface ICall {
  fn: string
  args: unknown[]
}

interface IBackendResult {
  returned: unknown
  calls: ICall[]
  kit: { option: string; value: { id: unknown; url: unknown } }[]
}

const SECONDARY_KEY = 'arts_header_custom_logo_secondary'
const KIT_ACTION = 'elementor/document/before_save'
const URL_7 = 'https://example.test/uploads/logo-7.png'

const published = (settings: Record<string, unknown>) => ({
  settings: { post_status: 'publish', ...settings }
})

const everything = published({
  site_favicon: { id: 9 },
  site_logo: { id: 5 },
  site_secondary_logo: { id: 7 }
})

const allThree: ICall[] = [
  { fn: 'update_option', args: ['site_icon', 9] },
  { fn: 'set_theme_mod', args: ['custom_logo', 5] },
  { fn: 'set_theme_mod', args: [SECONDARY_KEY, 7] }
]

interface ISaveCase {
  name: string
  data: unknown
  action?: string | false
  calls: ICall[]
}

/** Kit -> WordPress: `update_theme_mods_on_site_settings_save`, fired on every document save. */
const saveCases: ISaveCase[] = [
  {
    name: 'writes the favicon option and both logo theme mods on a published save',
    data: everything,
    calls: allThree
  },
  { name: 'ignores a save payload that is not an array', data: 'junk', calls: [] },
  { name: 'ignores a null payload', data: null, calls: [] },
  { name: 'ignores a payload without settings', data: {}, calls: [] },
  { name: 'ignores settings that are not an array', data: { settings: 'junk' }, calls: [] },
  {
    name: 'ignores a save without a post status',
    data: { settings: { site_logo: { id: 5 } } },
    calls: []
  },
  {
    name: 'ignores a draft save',
    data: { settings: { post_status: 'draft', site_logo: { id: 5 } } },
    calls: []
  },
  {
    name: 'ignores a pending save',
    data: { settings: { post_status: 'pending', site_logo: { id: 5 } } },
    calls: []
  },
  {
    name: 'ignores a non-string status',
    data: { settings: { post_status: ['publish'], site_logo: { id: 5 } } },
    calls: []
  },
  {
    name: 'skips a malformed site_logo and still syncs the secondary logo',
    data: published({ site_logo: 'junk', site_secondary_logo: { id: 7 } }),
    calls: [{ fn: 'set_theme_mod', args: [SECONDARY_KEY, 7] }]
  },
  {
    name: 'skips a secondary logo without an id and still syncs the logo',
    data: published({ site_logo: { id: 5 }, site_secondary_logo: {} }),
    calls: [{ fn: 'set_theme_mod', args: ['custom_logo', 5] }]
  },
  {
    name: 'skips a favicon without an id and still syncs the logo',
    data: published({ site_favicon: {}, site_logo: { id: 5 } }),
    calls: [{ fn: 'set_theme_mod', args: ['custom_logo', 5] }]
  },
  ...[
    'update_option_site_icon',
    'update_theme_mod_custom_logo',
    'pre_set_theme_mod_custom_logo',
    'pre_set_theme_mod_arts_header_custom_logo_secondary'
  ].map((action) => ({
    name: `bails out re-entrantly inside ${action}`,
    data: everything,
    action,
    calls: []
  })),
  {
    name: 'still syncs when only the middle of the action name matches a guarded prefix',
    data: everything,
    action: 'my_update_option_site_icon',
    calls: allThree
  },
  { name: 'still syncs with no current action', data: everything, action: false, calls: allThree }
]

describe.skipIf(!hasPhp)('Backend kit -> WordPress sync', () => {
  const results = lazyEmitter<IBackendResult>(
    'backend.php',
    saveCases.map((entry) => ({
      op: 'save',
      data: entry.data,
      currentAction: entry.action ?? KIT_ACTION
    }))
  )

  it.each(saveCases)('$name', (entry) => {
    expect(results()[saveCases.indexOf(entry)]?.calls).toEqual(entry.calls)
  })
})

const handlers = [
  ['secondary', 'site_secondary_logo'],
  ['logo', 'site_logo'],
  ['favicon', 'site_favicon']
] as const

interface ISyncCase {
  name: string
  value: unknown
  /** `null` when no kit update is expected. */
  url: string | null
  lookups: number
  elementor?: 'no-instance'
}

/** WordPress -> kit: the theme-mod / option filters push the attachment to Elementor. */
const syncCases: ISyncCase[] = [
  { name: 'resolves an integer attachment id to its URL', value: 7, url: URL_7, lookups: 1 },
  // The Customizer's `esc_attr` sanitizer hands the secondary-logo filter a string, never an int.
  {
    name: 'resolves a numeric-string attachment id to its URL',
    value: '7',
    url: URL_7,
    lookups: 1
  },
  { name: 'sends an empty URL for a removed logo (empty string)', value: '', url: '', lookups: 0 },
  { name: 'sends an empty URL for a non-numeric string', value: 'junk', url: '', lookups: 0 },
  { name: 'sends an empty URL for null', value: null, url: '', lookups: 0 },
  { name: 'sends an empty URL for false', value: false, url: '', lookups: 0 },
  {
    name: 'falls back to an empty URL when the attachment is gone',
    value: 99,
    url: '',
    lookups: 1
  },
  {
    name: 'leaves the kit alone when Elementor has no instance yet',
    value: 7,
    url: null,
    lookups: 0,
    elementor: 'no-instance'
  }
]

const syncRows = handlers.flatMap(([handler]) =>
  syncCases.map((entry) => ({
    op: 'sync',
    handler,
    value: entry.value,
    attachments: { 7: URL_7 },
    elementor: entry.elementor
  }))
)

describe.skipIf(!hasPhp)('Backend WordPress -> kit sync', () => {
  const results = lazyEmitter<IBackendResult>('backend.php', syncRows)

  describe.each(
    handlers.map(([handler, option], index) => ({ handler, option, index }))
  )('$handler handler', ({ option, index }) => {
    it.each(syncCases.map((entry, caseIndex) => ({ entry, caseIndex })))('$entry.name', ({
      entry,
      caseIndex
    }) => {
      const result = results()[index * syncCases.length + caseIndex]

      expect(result?.returned).toEqual(entry.value)
      expect(
        result?.calls.filter((call) => call.fn === 'wp_get_attachment_image_url')
      ).toHaveLength(entry.lookups)
      if (entry.url === null) {
        expect(result?.kit).toEqual([])
        return
      }
      expect(result?.kit).toHaveLength(1)
      expect(result?.kit[0]?.option).toBe(option)
      expect(result?.kit[0]?.value.url).toBe(entry.url)
      expect(String(result?.kit[0]?.value.id)).toBe(String(entry.value))
    })
  })

  it('hands the value back untouched when Elementor is not installed at all', () => {
    const [result] = lazyEmitter<IBackendResult>(
      'backend.php',
      [{ op: 'sync', handler: 'secondary', value: 7, attachments: { 7: URL_7 } }],
      ['--bare']
    )()

    expect(result).toEqual({ returned: 7, calls: [], kit: [] })
  })
})
