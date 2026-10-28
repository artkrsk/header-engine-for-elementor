// @vitest-environment happy-dom
import { resolveElementRef } from '@ts/sticky/resolveElement'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('resolveElementRef', () => {
  it('resolves nothing, silently, when no ref is configured', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(resolveElementRef(undefined, 'trigger')).toBeNull()
    expect(resolveElementRef('', 'trigger')).toBeNull()
    expect(warn).not.toHaveBeenCalled()
  })

  it('passes an element through without querying the document', () => {
    const query = vi.spyOn(document, 'querySelector')
    const element = document.createElement('div')
    expect(resolveElementRef(element, 'until')).toBe(element)
    expect(query).not.toHaveBeenCalled()
  })

  it('resolves a selector to the first match', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const first = document.createElement('section')
    first.className = 'boundary'
    const second = document.createElement('section')
    second.className = 'boundary'
    document.body.append(first, second)
    expect(resolveElementRef('.boundary', 'until')).toBe(first)
    expect(warn).not.toHaveBeenCalled()
  })

  it('warns once, naming the option and the selector, when a selector matches nothing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(resolveElementRef('.missing', 'until')).toBeNull()
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      ':Header [WARN] sticky.until selector matched nothing',
      '.missing'
    )
  })
})
