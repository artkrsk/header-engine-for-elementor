// @vitest-environment happy-dom
import { readTransitionDurationMs } from '@ts/utils'
import { describe, expect, it, vi } from 'vitest'

const withComputedDuration = (transitionDuration: string): HTMLElement => {
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({
    transitionDuration
  } as CSSStyleDeclaration)
  return document.createElement('div')
}

describe('readTransitionDurationMs', () => {
  it('treats a zero or missing duration as 0', () => {
    expect(readTransitionDurationMs(withComputedDuration('0s'))).toBe(0)
    expect(readTransitionDurationMs(withComputedDuration(''))).toBe(0)
  })

  it('converts plain seconds to milliseconds', () => {
    expect(readTransitionDurationMs(withComputedDuration('0.3s'))).toBe(300)
  })

  it('passes an ms-suffixed value through without conversion', () => {
    expect(readTransitionDurationMs(withComputedDuration('250ms'))).toBe(250)
  })

  it('never leaks NaN from a garbage token into timer math', () => {
    expect(readTransitionDurationMs(withComputedDuration('fast'))).toBe(0)
  })
})
