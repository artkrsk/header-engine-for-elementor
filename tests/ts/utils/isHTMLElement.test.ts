import { isHTMLElement } from '@ts/utils'
import { describe, expect, it } from 'vitest'

describe('isHTMLElement', () => {
  it('accepts any element-shaped object regardless of realm', () => {
    // nodeType === 1 is spec-fixed across realms — a plain object literal is a legitimate element
    // to every consumer (the engine never uses instanceof).
    expect(isHTMLElement({ nodeType: 1 })).toBe(true)
  })

  it('rejects non-element nodes', () => {
    expect(isHTMLElement({ nodeType: 3 })).toBe(false)
    expect(isHTMLElement({ nodeType: 9 })).toBe(false)
  })

  it('rejects primitives and null without throwing', () => {
    expect(isHTMLElement(null)).toBe(false)
    expect(isHTMLElement(undefined)).toBe(false)
    expect(isHTMLElement('div')).toBe(false)
    expect(isHTMLElement(1)).toBe(false)
  })
})
