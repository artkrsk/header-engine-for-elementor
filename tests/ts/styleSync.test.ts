import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { defaultConfig } from '@ts/constants'
import { describe, expect, it } from 'vitest'

/**
 * The engine's state-class strings are hand-synced between `defaultConfig` and the styles source —
 * no shared source of truth exists across the two languages. This suite is the mechanical guard on
 * that sync, scanning styles SOURCE text (robust here: the styles never generate selector names via
 * interpolation).
 *
 * Scope, decided deliberately:
 * - `selectors` (.js-* query hooks) are NOT checked — they are invisible to CSS by design.
 * - `classes.revealing` and `classes.hasHeaderHeight` are published for consumer styling only; the
 *   engine's own styles never key on them — excluded from the forward check, still covered by the
 *   reverse check if they ever appear.
 * - Every engine-written CSS var must appear in the styles source — `_tokens.scss` is the
 *   documented JS↔CSS contract home, so at minimum its contract docs name each one.
 */

const stylesDir = 'src/styles'

const styleSource = (): string =>
  readdirSync(stylesDir)
    .filter((file) => file.endsWith('.sass') || file.endsWith('.scss'))
    .map((file) => readFileSync(join(stylesDir, file), 'utf-8'))
    .join('\n')

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const CONSUMER_ONLY_CLASS_KEYS = new Set(['revealing', 'hasHeaderHeight'])

/** State-shaped classes the engine never toggles itself: authored by the consumer/editor markup. */
const NON_CONFIG_STATE_CLASSES = new Set(['arts-header_hero-bottom'])

describe('TS ↔ styles identifier sync', () => {
  it('finds every engine-styled state class from defaultConfig in the styles source', () => {
    const css = styleSource()
    const missing = Object.entries(defaultConfig.classes)
      .filter(([key, value]) => !CONSUMER_ONLY_CLASS_KEYS.has(key) && value.length > 0)
      .filter(([, value]) => !new RegExp(`(?<![\\w-])${escapeRegExp(value)}(?![\\w-])`).test(css))
      .map(([key]) => key)
    expect(missing).toEqual([])
  })

  it('finds every engine-written CSS var from defaultConfig in the styles source', () => {
    const css = styleSource()
    const missing = Object.entries(defaultConfig.vars)
      .filter(([, value]) => value.length > 0)
      .filter(([, value]) => !new RegExp(`(?<![\\w-])${escapeRegExp(value)}(?![\\w-])`).test(css))
      .map(([key]) => key)
    expect(missing).toEqual([])
  })

  it('keeps every state class in the styles source backed by defaultConfig', () => {
    // Single underscore only: `arts-header__bar` is a BEM element, not a state class.
    const css = styleSource()
    const known = new Set(Object.values(defaultConfig.classes))
    const orphans = [...css.matchAll(/arts-header_(?!_)[a-z][a-z-]*/g)]
      .map((match) => match[0])
      .filter((cls) => !known.has(cls) && !NON_CONFIG_STATE_CLASSES.has(cls))
    expect([...new Set(orphans)]).toEqual([])
  })
})
