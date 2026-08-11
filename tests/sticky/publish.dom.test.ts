// @vitest-environment happy-dom
import { createStateFlag } from '@ts/sticky/publish'
import { describe, expect, it } from 'vitest'

describe('createStateFlag', () => {
  it('toggles the bound class in step with the value', () => {
    const el = document.createElement('div')
    const flag = createStateFlag(el, 'arts-header_sticky')
    expect(flag.set(true)).toBe(true)
    expect(el.classList.contains('arts-header_sticky')).toBe(true)
    expect(flag.set(false)).toBe(true)
    expect(el.classList.contains('arts-header_sticky')).toBe(false)
  })

  it('memoizes — setting the same value reports no change and never touches the DOM', () => {
    const el = document.createElement('div')
    const flag = createStateFlag(el, 'arts-header_sticky')
    flag.set(true)
    el.classList.remove('arts-header_sticky')
    expect(flag.set(true)).toBe(false)
    expect(el.classList.contains('arts-header_sticky')).toBe(false)
  })

  it('never touches classList when the configured class is the empty-string opt-out', () => {
    const el = document.createElement('div')
    const flag = createStateFlag(el, '')
    expect(flag.set(true)).toBe(true)
    expect(el.className).toBe('')
  })

  it('reset forgets the value without touching the class — the keep-visual-state destroy path', () => {
    const el = document.createElement('div')
    const flag = createStateFlag(el, 'arts-header_sticky')
    flag.set(true)
    flag.reset()
    expect(flag.value).toBe(false)
    expect(el.classList.contains('arts-header_sticky')).toBe(true)
  })
})
