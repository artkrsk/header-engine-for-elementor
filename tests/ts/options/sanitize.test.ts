import {
  sanitizeHeightObserver,
  sanitizeInlineOptions,
  sanitizeReveal,
  sanitizeSticky,
  sanitizeToggleAttributes
} from '@ts/options/sanitize'
import { describe, expect, it } from 'vitest'

describe('sanitizeReveal', () => {
  it('drops a wrong-typed offset so the resolver default wins downstream', () => {
    expect(sanitizeReveal({ offset: '20' })).toEqual({})
  })

  it('drops non-finite numbers', () => {
    expect(sanitizeReveal({ offset: Number.NaN })).toEqual({})
    expect(sanitizeReveal({ offset: Number.POSITIVE_INFINITY })).toEqual({})
  })

  it('keeps well-typed fields and passes false through', () => {
    expect(sanitizeReveal({ mode: 'scrub', offset: 40 })).toEqual({ mode: 'scrub', offset: 40 })
    expect(sanitizeReveal(false)).toBe(false)
  })

  it('rejects an unknown mode token', () => {
    expect(sanitizeReveal({ mode: 'bounce' })).toEqual({})
  })
})

describe('sanitizeToggleAttributes', () => {
  it('drops a malformed entry without rejecting the surrounding map', () => {
    expect(
      sanitizeToggleAttributes({
        'data-good': { active: 'on', inactive: 'off' },
        'data-bad': 'not-an-object'
      })
    ).toEqual({ 'data-good': { active: 'on', inactive: 'off' } })
  })

  it('accepts the serialized-false editor contract', () => {
    expect(sanitizeToggleAttributes(false)).toBe(false)
  })
})

describe('sanitizeSticky', () => {
  it('admits selector strings only for trigger/until — an element cannot arrive via JSON', () => {
    expect(sanitizeSticky({ trigger: { nodeType: 1 }, until: 42 })).toEqual({})
  })

  it('returns undefined for a non-object section so defaults win', () => {
    expect(sanitizeSticky('yes')).toBeUndefined()
    expect(sanitizeSticky(1)).toBeUndefined()
  })

  it('passes false through and keeps nested sanitized sections', () => {
    expect(sanitizeSticky(false)).toBe(false)
    expect(sanitizeSticky({ trigger: '.pin', reveal: { offset: 10 } })).toEqual({
      trigger: '.pin',
      reveal: { offset: 10 }
    })
  })
})

describe('sanitizeHeightObserver', () => {
  it('keeps booleans and drops everything else', () => {
    expect(sanitizeHeightObserver({ observe: false, cleanupOnDestroy: 'yes' })).toEqual({
      observe: false
    })
  })
})

describe('sanitizeInlineOptions', () => {
  it('ignores unknown top-level keys', () => {
    expect(sanitizeInlineOptions({ unknown: 1, sticky: false })).toEqual({ sticky: false })
  })

  it('returns an empty object for non-object roots', () => {
    expect(sanitizeInlineOptions(null)).toEqual({})
    expect(sanitizeInlineOptions([1])).toEqual({})
  })
})
