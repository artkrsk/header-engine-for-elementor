import { resolveHeaderOptions } from '@ts/options/headerOptions'
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

  it('keeps a swap entry but drops its non-string or empty values', () => {
    expect(sanitizeToggleAttributes({ 'data-x': { inactive: '', active: 5 } })).toEqual({
      'data-x': {}
    })
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

  it('keeps until and a toggleAttributes map next to trigger', () => {
    expect(
      sanitizeSticky({
        trigger: '.pin',
        until: '.footer',
        toggleAttributes: { 'data-logo': { inactive: 'light', active: 'dark' } }
      })
    ).toEqual({
      trigger: '.pin',
      until: '.footer',
      toggleAttributes: { 'data-logo': { inactive: 'light', active: 'dark' } }
    })
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
  it('keeps cleanupOnDestroy: true', () => {
    expect(sanitizeHeightObserver({ observe: true, cleanupOnDestroy: true })).toEqual({
      observe: true,
      cleanupOnDestroy: true
    })
  })

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

  it('carries until, toggleAttributes and cleanupOnDestroy through JSON into the resolved options', () => {
    const payload = {
      sticky: {
        until: '.footer',
        toggleAttributes: { 'data-logo': { inactive: 'light', active: 'dark' } }
      },
      heightObserver: { cleanupOnDestroy: true }
    }
    const resolved = resolveHeaderOptions(
      sanitizeInlineOptions(JSON.parse(JSON.stringify(payload)))
    )
    expect(resolved.sticky).toMatchObject(payload.sticky)
    expect(resolved.heightObserver).toMatchObject(payload.heightObserver)
  })

  it('returns an empty object for non-object roots', () => {
    expect(sanitizeInlineOptions(null)).toEqual({})
    expect(sanitizeInlineOptions([1])).toEqual({})
  })
})
