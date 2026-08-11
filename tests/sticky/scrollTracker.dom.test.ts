// @vitest-environment happy-dom
import { createScrollTracker } from '@ts/sticky/scrollTracker'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeRaf, setScroll, setScrollBounds } from '../support'

beforeEach(() => {
  vi.useFakeTimers()
  setScrollBounds(5000, 800)
  setScroll(0, 0)
})

afterEach(() => {
  vi.useRealTimers()
})

const scrollTo = (y: number): void => {
  setScroll(0, y)
  window.dispatchEvent(new Event('scroll'))
}

describe('createScrollTracker', () => {
  it('coalesces several scroll events into one rAF tick with the net delta', () => {
    const raf = fakeRaf()
    const spy = vi.fn()
    const tracker = createScrollTracker(spy)
    scrollTo(10)
    scrollTo(25)
    expect(raf.pendingCount).toBe(1)
    raf.step()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(25, 25)
    tracker.destroy()
  })

  it('reports per-tick deltas against the previous tick', () => {
    const raf = fakeRaf()
    const spy = vi.fn()
    const tracker = createScrollTracker(spy)
    scrollTo(10)
    raf.step()
    scrollTo(4)
    raf.step()
    expect(spy).toHaveBeenNthCalledWith(1, 10, 10)
    expect(spy).toHaveBeenNthCalledWith(2, 4, -6)
    tracker.destroy()
  })

  it('clamps against the CACHED bounds — no layout read on the tick path', () => {
    const raf = fakeRaf()
    const spy = vi.fn()
    const tracker = createScrollTracker(spy)
    // Overscroll past the cached max (5000 - 800 = 4200) reads as the max, and the rubber-band
    // bounce back produces no phantom delta.
    scrollTo(4500)
    raf.step()
    expect(spy).toHaveBeenLastCalledWith(4200, 4200)
    scrollTo(-50)
    raf.step()
    expect(spy).toHaveBeenLastCalledWith(0, -4200)
    tracker.destroy()
  })

  it('refreshes the cached bounds on a settled window resize', () => {
    const raf = fakeRaf()
    const spy = vi.fn()
    const tracker = createScrollTracker(spy)
    setScrollBounds(10000, 800)
    window.dispatchEvent(new Event('resize'))
    vi.advanceTimersByTime(150)
    scrollTo(6000)
    raf.step()
    expect(spy).toHaveBeenLastCalledWith(6000, 6000)
    tracker.destroy()
  })

  it('readY reads fresh without disturbing the tick baseline', () => {
    const raf = fakeRaf()
    const spy = vi.fn()
    const tracker = createScrollTracker(spy)
    setScroll(0, 300)
    expect(tracker.readY()).toBe(300)
    scrollTo(310)
    raf.step()
    // Delta measured against the seed baseline (0), not readY's 300.
    expect(spy).toHaveBeenCalledWith(310, 310)
    tracker.destroy()
  })

  it('destroy detaches the listeners — later scrolls never tick', () => {
    const raf = fakeRaf()
    const spy = vi.fn()
    const tracker = createScrollTracker(spy)
    tracker.destroy()
    scrollTo(100)
    raf.step()
    expect(spy).not.toHaveBeenCalled()
  })
})
