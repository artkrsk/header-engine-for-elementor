import { parseRevealOffset, resolvePinLine } from '@ts/sticky/measure'
import { describe, expect, it } from 'vitest'

describe('resolvePinLine', () => {
  it('reads a top-pinned sticky wrapper, negative offsets included (compact-header trick)', () => {
    expect(resolvePinLine('sticky', '65px', 'auto', 32)).toEqual({ edge: 'top', offset: 65 })
    expect(resolvePinLine('sticky', '-88px', 'auto', 0)).toEqual({ edge: 'top', offset: -88 })
  })

  it('reads a bottom-pinned sticky wrapper from top:auto', () => {
    expect(resolvePinLine('sticky', 'auto', '0px', 0)).toEqual({ edge: 'bottom', offset: 0 })
    expect(resolvePinLine('sticky', 'auto', '24px', 32)).toEqual({ edge: 'bottom', offset: 24 })
  })

  it('falls back to the admin-bar line for non-sticky positioning and unparsable values', () => {
    expect(resolvePinLine('fixed', '0px', 'auto', 32)).toEqual({ edge: 'top', offset: 32 })
    expect(resolvePinLine('static', 'auto', 'auto', 0)).toEqual({ edge: 'top', offset: 0 })
    expect(resolvePinLine('sticky', 'junk', 'auto', 32)).toEqual({ edge: 'top', offset: 32 })
    expect(resolvePinLine('sticky', 'auto', 'junk', 32)).toEqual({ edge: 'bottom', offset: 0 })
  })
})

describe('parseRevealOffset', () => {
  it('parses a resolved pixel length (the registered-property computed form)', () => {
    expect(parseRevealOffset('120px')).toBe(120)
    expect(parseRevealOffset(' 64.5px ')).toBe(64.5)
    expect(parseRevealOffset('0px')).toBe(0)
  })

  it('falls back to 0 for anything but a px token — unregistered raw values stay unresolved', () => {
    expect(parseRevealOffset('')).toBe(0)
    expect(parseRevealOffset('100vh')).toBe(0)
    expect(parseRevealOffset('calc(100vh - 80px)')).toBe(0)
    expect(parseRevealOffset('junk')).toBe(0)
  })
})
