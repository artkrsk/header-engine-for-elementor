import { shouldProcessTick } from '@ts/sticky/createSticky'
import { describe, expect, it } from 'vitest'

const base = { locked: false, stuck: true, released: false, delta: 10 }

describe('shouldProcessTick', () => {
  it('processes a real delta while stuck, unlocked and unreleased', () => {
    expect(shouldProcessTick(base)).toBe(true)
  })

  it('freezes while locked', () => {
    expect(shouldProcessTick({ ...base, locked: true })).toBe(false)
  })

  it('has nothing to reveal before sticking', () => {
    expect(shouldProcessTick({ ...base, stuck: false })).toBe(false)
  })

  it('hands the bar to normal scroll while released', () => {
    expect(shouldProcessTick({ ...base, released: true })).toBe(false)
  })

  it('ignores sub-pixel jitter in both directions', () => {
    expect(shouldProcessTick({ ...base, delta: 0.5 })).toBe(false)
    expect(shouldProcessTick({ ...base, delta: -0.5 })).toBe(false)
    expect(shouldProcessTick({ ...base, delta: -1 })).toBe(true)
  })
})
