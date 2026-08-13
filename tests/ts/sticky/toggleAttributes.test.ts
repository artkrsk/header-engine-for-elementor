import { resolveAttributeValue } from '@ts/sticky/toggleAttributes'
import { describe, expect, it } from 'vitest'

describe('resolveAttributeValue', () => {
  it('picks the side matching the direction', () => {
    const entry = { active: 'on', inactive: 'off' }
    expect(resolveAttributeValue(entry, true)).toBe('on')
    expect(resolveAttributeValue(entry, false)).toBe('off')
  })

  it('resolves a missing side to removal — the swap stays symmetric', () => {
    expect(resolveAttributeValue({ active: 'on' }, false)).toBeNull()
    expect(resolveAttributeValue({ inactive: 'off' }, true)).toBeNull()
  })

  it('treats an empty string like an absent value', () => {
    expect(resolveAttributeValue({ active: '' }, true)).toBeNull()
  })

  it('resolves an undefined entry to removal on both sides', () => {
    expect(resolveAttributeValue(undefined, true)).toBeNull()
    expect(resolveAttributeValue(undefined, false)).toBeNull()
  })
})
