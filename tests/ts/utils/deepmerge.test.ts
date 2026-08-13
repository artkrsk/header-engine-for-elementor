import { deepmerge } from '@ts/utils'
import { describe, expect, it } from 'vitest'

describe('deepmerge', () => {
  it('merges nested objects deeply', () => {
    const result = deepmerge({ a: { b: 1, c: 2 } }, { a: { c: 3 } })
    expect(result).toEqual({ a: { b: 1, c: 3 } })
  })

  it('never lets an undefined source value clobber the target', () => {
    // The mechanism the config/options opt-out contracts depend on: only stated overrides win.
    const source: { keep?: string | undefined } = { keep: undefined }
    const result = deepmerge({ keep: 'value' }, source)
    expect(result.keep).toBe('value')
  })

  it('overwrites with an empty string (an explicit opt-out is a stated value, not an absence)', () => {
    const result = deepmerge({ cls: 'arts-header_sticky' }, { cls: '' })
    expect(result.cls).toBe('')
  })

  it('concatenates arrays instead of replacing them', () => {
    const result = deepmerge({ list: [1, 2] }, { list: [3] })
    expect(result.list).toEqual([1, 2, 3])
  })

  it('mutates neither input', () => {
    const target = { a: { b: 1 } }
    const source = { a: { b: 2 } }
    deepmerge(target, source)
    expect(target).toEqual({ a: { b: 1 } })
    expect(source).toEqual({ a: { b: 2 } })
  })
})
