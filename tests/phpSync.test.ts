import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  BAR_ABSOLUTE_CLASS,
  BAR_CLASS,
  BAR_FIXED_CLASS,
  BAR_JS_CLASS,
  defaultConfig,
  OPTIONS_ATTR,
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
  readFileSync(resolve(__dirname, `../src/php/Elementor/${file}`), 'utf8')

/** Panel keys the editor-side handler reads; PHP must define and read the same names. */
const PANEL_KEYS = [
  'arts_header_enabled',
  'arts_header_sticky_enabled',
  'arts_header_sticky_toggle_reveal_enabled'
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
    OPTIONS_ATTR
  ])('prints %s', (identifier) => {
    expect(markup).toContain(`'${identifier}'`)
  })

  it('seeds both engine height vars and the height class pre-paint', () => {
    expect(markup).toContain(defaultConfig.vars.headerHeight)
    expect(markup).toContain(defaultConfig.vars.headerHeightNonSticky)
    expect(markup).toContain(defaultConfig.classes.hasHeaderHeight)
  })

  it.each([
    'arts_header_enabled',
    'arts_header_sticky_enabled',
    'arts_header_sticky_toggle_reveal_enabled'
  ])('reads the %s panel setting', (key) => {
    expect(markup).toContain(`'${key}'`)
  })
})

describe('Controls.php defines the frontend_available panel keys', () => {
  const controls = php('Controls.php')

  it.each(PANEL_KEYS)('defines %s', (key) => {
    expect(controls).toContain(`'${key}'`)
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
