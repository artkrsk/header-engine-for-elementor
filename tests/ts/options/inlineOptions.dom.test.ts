// @vitest-environment happy-dom
import { readInlineOptions } from '@ts/options/inlineOptions'
import { describe, expect, it, vi } from 'vitest'

const containerWith = (attr?: string): HTMLElement => {
  const el = document.createElement('div')
  if (attr !== undefined) {
    el.setAttribute('data-arts-header-options', attr)
  }
  return el
}

describe('readInlineOptions', () => {
  it('returns undefined silently when the attribute is absent', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(readInlineOptions(containerWith())).toBeUndefined()
    expect(warn).not.toHaveBeenCalled()
  })

  it('warns and returns undefined for garbage — constructor options must survive', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(readInlineOptions(containerWith('{"unterminated": '))).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('treats an authored empty object as a valid (empty) inline config', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(readInlineOptions(containerWith(' { } '))).toEqual({})
    expect(warn).not.toHaveBeenCalled()
  })

  it('sanitizes a valid payload, stripping unknown and wrong-typed fields', () => {
    const raw = JSON.stringify({
      sticky: { reveal: 'yes', trigger: '.pin', junk: true },
      mystery: 1
    })
    expect(readInlineOptions(containerWith(raw))).toEqual({
      sticky: { trigger: '.pin' }
    })
  })

  it('recovers relaxed JSON via the lenient parser', () => {
    expect(readInlineOptions(containerWith('{sticky: {reveal: false}}'))).toEqual({
      sticky: { reveal: false }
    })
  })

  it('warns on a non-object payload (arrays, null) instead of adopting it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(readInlineOptions(containerWith('[1, 2]'))).toBeUndefined()
    expect(readInlineOptions(containerWith('null'))).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(2)
  })
})
