import { PIN_EPSILON_PX, resolvePinned } from '@ts/sticky/pinned'
import { describe, expect, it } from 'vitest'

const top = (offset: number) => ({ edge: 'top', offset }) as const
const bottom = (offset: number) => ({ edge: 'bottom', offset }) as const

describe('resolvePinned — top edge', () => {
  it('pins once the page scrolls the natural position past the pin line, with the 1px slack', () => {
    expect(resolvePinned(top(0), 100, 80, 100, 900)).toBe(false)
    expect(resolvePinned(top(0), 100, 80, 100 + PIN_EPSILON_PX, 900)).toBe(true)
    expect(resolvePinned(top(0), 100, 80, 500, 900)).toBe(true)
  })

  it('keeps a header resting exactly at its line un-pinned (overlay at page top, y=0)', () => {
    expect(resolvePinned(top(0), 0, 80, 0, 900)).toBe(false)
    expect(resolvePinned(top(0), 0, 80, 1, 900)).toBe(true)
  })

  it('honors a custom pin offset — pins earlier by the offset', () => {
    expect(resolvePinned(top(100), 500, 80, 400, 900)).toBe(false)
    expect(resolvePinned(top(100), 500, 80, 401, 900)).toBe(true)
  })

  it('handles a negative compact-header offset — pins later', () => {
    expect(resolvePinned(top(-88), 100, 80, 188, 900)).toBe(false)
    expect(resolvePinned(top(-88), 100, 80, 189, 900)).toBe(true)
  })

  it('treats a pin line beyond the viewport as degenerate — never pinned', () => {
    expect(resolvePinned(top(1000), 100, 80, 5000, 900)).toBe(false)
  })
})

describe('resolvePinned — bottom edge', () => {
  it('pins while the natural position still sits below the bottom slot line', () => {
    // Slot line at 900 - 0 - 80 = 820: natural 2000 is below it until y reaches 1180.
    expect(resolvePinned(bottom(0), 2000, 80, 1179, 900)).toBe(true)
    expect(resolvePinned(bottom(0), 2000, 80, 1181, 900)).toBe(false)
  })

  it('honors a bottom pin offset', () => {
    // Slot line at 900 - 24 - 80 = 796.
    expect(resolvePinned(bottom(24), 2000, 80, 1203, 900)).toBe(true)
    expect(resolvePinned(bottom(24), 2000, 80, 1205, 900)).toBe(false)
  })

  it('treats a slot line at or above the viewport top as degenerate — never pinned', () => {
    expect(resolvePinned(bottom(850), 2000, 80, 0, 900)).toBe(false)
  })

  it('uses the passed pinned (slot) height, which can exceed the live bar height', () => {
    // Frozen 140px rest slot: line at 900 - 0 - 140 = 760 → still pinned at y=1220.
    expect(resolvePinned(bottom(0), 2000, 140, 1220, 900)).toBe(true)
    // The shrunk 100px live bar would put the line at 800 and flip 40px early.
    expect(resolvePinned(bottom(0), 2000, 100, 1220, 900)).toBe(false)
  })
})
