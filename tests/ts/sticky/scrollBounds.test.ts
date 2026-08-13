import { clampScroll } from '@ts/sticky/scrollBounds'
import { describe, expect, it } from 'vitest'

describe('clampScroll', () => {
  it('ignores rubber-band overscroll on both ends', () => {
    expect(clampScroll(-30, 1000)).toBe(0)
    expect(clampScroll(1200, 1000)).toBe(1000)
  })

  it('passes in-range positions through', () => {
    expect(clampScroll(500, 1000)).toBe(500)
  })

  it('collapses everything to zero on an unscrollable page', () => {
    expect(clampScroll(50, 0)).toBe(0)
  })
})
