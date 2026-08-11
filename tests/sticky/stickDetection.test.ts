import { resolveOvershoot, resolveStuck } from '@ts/sticky/stickDetection'
import { describe, expect, it } from 'vitest'

const entry = (isIntersecting: boolean, top: number) => ({
  isIntersecting,
  boundingClientRect: { top }
})

describe('resolveStuck', () => {
  it('reads a crossing above the sticky line as stuck', () => {
    expect(resolveStuck(entry(false, -10), 0)).toBe(true)
    expect(resolveStuck(entry(false, 30), 30)).toBe(true)
  })

  it('never reads an intersecting target as stuck, regardless of its top', () => {
    expect(resolveStuck(entry(true, -10), 0)).toBe(false)
  })

  it('keeps a mid-page target still below the fold un-stuck', () => {
    // Non-intersecting because it has not scrolled into the shrunk root yet — the case the
    // boundingClientRect check exists for.
    expect(resolveStuck(entry(false, 900), 0)).toBe(false)
  })
})

describe('resolveOvershoot', () => {
  it('measures how far past the line the crossing delivered', () => {
    expect(resolveOvershoot(entry(false, -25), 0)).toBe(25)
    expect(resolveOvershoot(entry(false, 5), 30)).toBe(25)
  })

  it('floors at zero on the exact boundary', () => {
    expect(resolveOvershoot(entry(false, 0), 0)).toBe(0)
  })

  it('reports zero when not stuck', () => {
    expect(resolveOvershoot(entry(true, -25), 0)).toBe(0)
    expect(resolveOvershoot(entry(false, 900), 0)).toBe(0)
  })
})
