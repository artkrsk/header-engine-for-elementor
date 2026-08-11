// @vitest-environment happy-dom
import { applyToggleAttributes } from '@ts/sticky/toggleAttributes'
import { describe, expect, it } from 'vitest'

describe('applyToggleAttributes', () => {
  it('swaps to the active value on stick and back to inactive on unstick', () => {
    const el = document.createElement('div')
    const map = { 'data-state': { inactive: 'rest', active: 'stuck' } }
    applyToggleAttributes(el, map, true)
    expect(el.getAttribute('data-state')).toBe('stuck')
    applyToggleAttributes(el, map, false)
    expect(el.getAttribute('data-state')).toBe('rest')
  })

  it('removes the attribute when the target side has no value — no stranded values', () => {
    const el = document.createElement('div')
    const map = { 'data-state': { active: 'stuck' } }
    applyToggleAttributes(el, map, true)
    applyToggleAttributes(el, map, false)
    expect(el.hasAttribute('data-state')).toBe(false)
  })

  it('no-ops for the serialized-false editor contract and for malformed shapes', () => {
    const el = document.createElement('div')
    el.setAttribute('data-state', 'untouched')
    applyToggleAttributes(el, false, true)
    applyToggleAttributes(el, 'yes' as unknown as false, true)
    expect(el.getAttribute('data-state')).toBe('untouched')
  })
})
