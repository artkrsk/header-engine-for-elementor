import { nextScrubOffset, scrubTransform, shouldOwnTransformViaCSS } from '@ts/sticky/revealScrub'
import { describe, expect, it } from 'vitest'

describe('nextScrubOffset', () => {
  it('clamps to the bar height on the way down', () => {
    expect(nextScrubOffset(70, 30, 80)).toBe(80)
  })

  it('clamps to zero on the way up', () => {
    expect(nextScrubOffset(10, -30, 80)).toBe(0)
  })

  it('accumulates freely inside the window', () => {
    expect(nextScrubOffset(10, 15, 80)).toBe(25)
    expect(nextScrubOffset(25, -5, 80)).toBe(20)
  })

  it('returns the unchanged value at a saturated edge — the no-write signal', () => {
    expect(nextScrubOffset(80, 5, 80)).toBe(80)
    expect(nextScrubOffset(0, -5, 80)).toBe(0)
  })
})

describe('scrubTransform', () => {
  it('translates the wrapper up by the accumulator', () => {
    expect(scrubTransform(42)).toBe('translateY(-42px)')
    expect(scrubTransform(0)).toBe('translateY(-0px)')
  })
})

describe('shouldOwnTransformViaCSS', () => {
  it('hands the transform to CSS while locked or hidden, and only then', () => {
    expect(shouldOwnTransformViaCSS(false, false)).toBe(false)
    expect(shouldOwnTransformViaCSS(true, false)).toBe(true)
    expect(shouldOwnTransformViaCSS(false, true)).toBe(true)
    expect(shouldOwnTransformViaCSS(true, true)).toBe(true)
  })
})
