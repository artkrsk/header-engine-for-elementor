import {
  sanitizeHeightObserver,
  sanitizeInlineOptions,
  sanitizeSticky,
  sanitizeToggleAttributes
} from '@ts/options/sanitize'
import { describe, expect, it } from 'vitest'

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

  it('passes false through, keeps boolean reveal/zones, and drops a legacy object reveal', () => {
    expect(sanitizeSticky(false)).toBe(false)
    expect(sanitizeSticky({ trigger: '.pin', reveal: false, zones: false })).toEqual({
      trigger: '.pin',
      reveal: false,
      zones: false
    })
    // Pre-boolean schema ({ offset }) drops the field so the resolver default (enabled) wins.
    expect(sanitizeSticky({ reveal: { offset: 10 }, zones: 'yes' })).toEqual({})
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
