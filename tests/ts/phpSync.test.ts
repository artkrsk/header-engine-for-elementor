import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  BAR_ABSOLUTE_CLASS,
  BAR_BOTTOM_CLASS,
  BAR_CLASS,
  BAR_FIXED_CLASS,
  BAR_JS_CLASS,
  BAR_STICKY_BOTTOM_CLASS,
  BAR_STICKY_CLASS,
  defaultConfig,
  HIDE_ZONE_ATTR,
  LOCK_ZONE_ATTR,
  NON_STICKY_LOGO_ATTR,
  OPTIONS_ATTR,
  STICKY_LOGO_ATTR,
  WRAPPER_CLASS,
  WRAPPER_ELEMENT_ID_PREFIX,
  WRAPPER_JS_CLASS
} from '@ts/constants'
import { describe, expect, it } from 'vitest'

/**
 * The PHP layer hand-mirrors the TS identifier contract (no shared source of
 * truth across the languages) — this is the styleSync guard extended to PHP.
 */

const php = (file: string): string =>
  readFileSync(resolve(__dirname, `../../src/php/Elementor/${file}`), 'utf8')

/** Panel keys the editor-side handler reads; PHP must define and read the same names. */
const PANEL_KEYS = [
  'arts_header_enabled',
  'arts_header_position',
  'arts_header_on_scroll',
  'arts_header_stick_to',
  'arts_header_zone',
  'arts_header_zone_geometry',
  'arts_header_state_non_sticky_logo_version',
  'arts_header_state_sticky_logo_version'
]

/** CSS-write keys: Elementor's own selectors pipeline consumes them, not the editor JS. */
const CSS_WRITE_KEYS = [
  'padding_sticky',
  'arts_header_sticky_global_colors',
  'arts_header_sticky_reveal_offset_preset',
  'arts_header_sticky_reveal_offset',
  'arts_header_pin_offset_preset',
  'arts_header_pin_offset'
]

describe('Markup.php mirrors the TS identifier contract', () => {
  const markup = php('Markup.php')

  it.each([
    WRAPPER_CLASS,
    WRAPPER_JS_CLASS,
    WRAPPER_ELEMENT_ID_PREFIX,
    BAR_CLASS,
    BAR_JS_CLASS,
    BAR_FIXED_CLASS,
    BAR_ABSOLUTE_CLASS,
    BAR_BOTTOM_CLASS,
    BAR_STICKY_CLASS,
    BAR_STICKY_BOTTOM_CLASS,
    OPTIONS_ATTR
  ])('prints %s', (identifier) => {
    expect(markup).toContain(`'${identifier}'`)
  })

  it('marks secondary headers off the page globals in their options JSON', () => {
    expect(markup).toContain("'heightObserver'")
    expect(markup).toContain("'zones'")
  })

  it('seeds both engine height vars and the height class pre-paint', () => {
    expect(markup).toContain(defaultConfig.vars.headerHeight)
    expect(markup).toContain(defaultConfig.vars.headerHeightNonSticky)
    expect(markup).toContain(defaultConfig.classes.hasHeaderHeight)
  })

  it.each([
    NON_STICKY_LOGO_ATTR,
    STICKY_LOGO_ATTR
  ])('prints the %s logo-version attribute', (attr) => {
    expect(markup).toContain(`'${attr}'`)
  })

  it('renders the zone attributes from the Header Zone panel keys', () => {
    expect(markup).toContain(`'${HIDE_ZONE_ATTR}'`)
    expect(markup).toContain(`'${LOCK_ZONE_ATTR}'`)
    expect(markup).toContain("'arts_header_zone'")
    expect(markup).toContain("'arts_header_zone_geometry'")
  })

  it.each([
    'arts_header_enabled',
    'arts_header_position',
    'arts_header_on_scroll',
    'arts_header_stick_to'
  ])('reads the %s panel setting', (key) => {
    expect(markup).toContain(`'${key}'`)
  })
})

describe('Controls.php defines the frontend_available panel keys', () => {
  const controls = php('Controls.php')

  it.each(PANEL_KEYS)('defines %s', (key) => {
    expect(controls).toContain(`'${key}'`)
  })

  it.each(CSS_WRITE_KEYS)('defines the %s control', (key) => {
    expect(controls).toContain(`'${key}'`)
  })

  // Sticky padding must mirror the native padding control's idiom: Elementor applies vertical
  // padding on `.e-con-full` / boxed `.e-con > .e-con-inner`, so only overriding its
  // `--padding-*` custom properties (which inherit) reaches both layouts.
  it('writes all four native --padding-* custom properties from padding_sticky', () => {
    for (const side of ['top', 'right', 'bottom', 'left']) {
      expect(controls).toContain(`--padding-${side}: {{${side.toUpperCase()}}}{{UNIT}}`)
    }
  })

  // Scope split: in-box sticky styles (backgrounds, borders, padding, recolor) ride
  // HEADER_STICKY_STATE_BAR_SELECTOR (`_sticky` alone) so they hold through the hide/reveal
  // slide; ONLY box-shadow may use the `:not(_scrolling-down)` visible scope — it paints outside
  // the box and would bleed into the viewport while the bar sits hidden. Two references =
  // the constant's own definition + the box_shadow_sticky usage.
  it('reserves the visible (:not scrolling-down) bar scope for the box shadow alone', () => {
    expect(controls.match(/HEADER_STICKY_BAR_SELECTOR/g)?.length).toBe(2)
  })

  // The sticky recolor rides Elementor's own kit idiom: redefining the inherited
  // `--e-global-color-{id}` custom properties inside the stuck bar re-colors every
  // widget that consumes that global. The var-name interpolation from the sibling
  // repeater field is the same pattern the kit's Global Colors panel uses.
  it('remaps global colors via the kit var idiom', () => {
    expect(controls).toContain('--e-global-color-{{global_id.VALUE}}: {{VALUE}}')
  })

  it('writes the engine-read reveal-offset var from both offset controls', () => {
    expect(controls.split(defaultConfig.vars.revealOffset).length - 1).toBeGreaterThanOrEqual(2)
  })

  it('writes the pin-offset var from both pin controls', () => {
    expect(controls.split('--arts-header-pin-offset').length - 1).toBeGreaterThanOrEqual(2)
  })

  it('defines the Header Zone keys with the engine geometry literals', () => {
    expect(controls).toContain("'arts_header_zone'")
    expect(controls).toContain("'arts_header_zone_geometry'")
    for (const geometry of ['at-top', 'overlap', 'in-view']) {
      expect(controls).toContain(`'${geometry}'`)
    }
  })

  it('marks every panel key frontend_available', () => {
    const occurrences = controls.match(/'frontend_available'\s*=>\s*true/g) ?? []
    expect(occurrences.length).toBeGreaterThanOrEqual(PANEL_KEYS.length)
  })
})

describe('Assets.php provides the editor-flag global', () => {
  it('bootstraps window.artsHeaderOptions.isElementorEditor', () => {
    const assets = php('Assets.php')
    expect(assets).toContain('artsHeaderOptions')
    expect(assets).toContain('isElementorEditor')
  })
})
