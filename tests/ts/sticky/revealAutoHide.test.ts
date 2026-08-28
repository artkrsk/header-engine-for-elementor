import { decideAutoHide } from '@ts/sticky/revealAutoHide'
import { describe, expect, it } from 'vitest'

describe('decideAutoHide', () => {
  it('hides on a downward move past the sticky line plus offset', () => {
    expect(decideAutoHide(5, 300, 0, 100)).toEqual({ scrollingDown: true, revealing: false })
  })

  it('does nothing on a downward move still inside the offset slack', () => {
    expect(decideAutoHide(5, 90, 0, 100)).toBeNull()
    expect(decideAutoHide(5, 100, 0, 100)).toBeNull()
  })

  it('reveals on any upward move regardless of the offset', () => {
    expect(decideAutoHide(-5, 50, 0, 100)).toEqual({ scrollingDown: false, revealing: true })
    expect(decideAutoHide(-5, 5000, 0, 100)).toEqual({ scrollingDown: false, revealing: true })
  })

  it('does nothing on a zero delta', () => {
    expect(decideAutoHide(0, 300, 0, 0)).toBeNull()
  })

  it('honors the sticky line offset (admin bar) in the hide gate', () => {
    expect(decideAutoHide(5, 110, 32, 100)).toBeNull()
    expect(decideAutoHide(5, 133, 32, 100)).toEqual({ scrollingDown: true, revealing: false })
  })
})
