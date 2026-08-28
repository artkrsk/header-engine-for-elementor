// @vitest-environment happy-dom
import { subscribeScroll } from '@ts/sticky/subscribeScroll'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeRaf, fakeResizeObserver, setScroll, setScrollBounds } from '../support'

/**
 * The bus is a module-scope refcounted singleton — every test MUST destroy its subscriptions
 * (tracked + afterEach) so the next test's fresh stubs are picked up on re-install.
 */

const subscriptions: { destroy(): void }[] = []
const subscribe = (sub: Parameters<typeof subscribeScroll>[0]) => {
  const subscription = subscribeScroll(sub)
  subscriptions.push(subscription)
  return subscription
}

beforeEach(() => {
  vi.useFakeTimers()
  setScrollBounds(5000, 800)
  setScroll(0, 0)
})

afterEach(() => {
  for (const subscription of subscriptions) {
    subscription.destroy()
  }
  subscriptions.length = 0
  vi.useRealTimers()
})

const scrollTo = (y: number): void => {
  setScroll(0, y)
  window.dispatchEvent(new Event('scroll'))
}

describe('subscribeScroll — single-subscriber contract', () => {
  it('coalesces several scroll events into one rAF tick with the net delta', () => {
    const raf = fakeRaf()
    const spy = vi.fn()
    subscribe({ onTick: spy })
    scrollTo(10)
    scrollTo(25)
    expect(raf.pendingCount).toBe(1)
    raf.step()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(25, 25)
  })

  it('reports per-tick deltas against the previous tick', () => {
    const raf = fakeRaf()
    const spy = vi.fn()
    subscribe({ onTick: spy })
    scrollTo(10)
    raf.step()
    scrollTo(4)
    raf.step()
    expect(spy).toHaveBeenNthCalledWith(1, 10, 10)
    expect(spy).toHaveBeenNthCalledWith(2, 4, -6)
  })

  it('clamps against the CACHED bounds — no layout read on the tick path', () => {
    const raf = fakeRaf()
    const spy = vi.fn()
    subscribe({ onTick: spy })
    // Overscroll past the cached max (5000 - 800 = 4200) reads as the max, and the rubber-band
    // bounce back produces no phantom delta.
    scrollTo(4500)
    raf.step()
    expect(spy).toHaveBeenLastCalledWith(4200, 4200)
    scrollTo(-50)
    raf.step()
    expect(spy).toHaveBeenLastCalledWith(0, -4200)
  })

  it('refreshes the cached bounds on a settled window resize', () => {
    const raf = fakeRaf()
    const spy = vi.fn()
    subscribe({ onTick: spy })
    setScrollBounds(10000, 800)
    window.dispatchEvent(new Event('resize'))
    vi.advanceTimersByTime(150)
    scrollTo(6000)
    raf.step()
    expect(spy).toHaveBeenLastCalledWith(6000, 6000)
  })

  it('refreshes the cached bounds when the document grows without a resize (lazy content)', () => {
    const observers = fakeResizeObserver()
    const raf = fakeRaf()
    const spy = vi.fn()
    const subscription = subscribe({ onTick: spy })
    expect(observers[0]?.observed[0]?.target).toBe(document.documentElement)
    // Lazy images inflate the page after boot; no window resize ever fires.
    setScrollBounds(10000, 800)
    observers[0]?.callback([], {} as ResizeObserver)
    vi.advanceTimersByTime(150)
    scrollTo(6000)
    raf.step()
    expect(spy).toHaveBeenLastCalledWith(6000, 6000)
    subscription.destroy()
    expect(observers[0]?.disconnectCount).toBe(1)
  })

  it('readY reads fresh without disturbing the tick baseline', () => {
    const raf = fakeRaf()
    const spy = vi.fn()
    const subscription = subscribe({ onTick: spy })
    setScroll(0, 300)
    expect(subscription.readY()).toBe(300)
    scrollTo(310)
    raf.step()
    // Delta measured against the seed baseline (0), not readY's 300.
    expect(spy).toHaveBeenCalledWith(310, 310)
  })

  it('destroy detaches the listeners — later scrolls never tick', () => {
    const raf = fakeRaf()
    const spy = vi.fn()
    const subscription = subscribe({ onTick: spy })
    subscription.destroy()
    scrollTo(100)
    raf.step()
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('subscribeScroll — shared singleton', () => {
  it('two subscribers share ONE rAF tick and receive the identical (y, delta) stream', () => {
    const raf = fakeRaf()
    const first = vi.fn()
    const second = vi.fn()
    subscribe({ onTick: first })
    subscribe({ onTick: second })
    scrollTo(10)
    scrollTo(25)
    expect(raf.pendingCount).toBe(1)
    raf.step()
    expect(first).toHaveBeenCalledTimes(1)
    expect(first).toHaveBeenCalledWith(25, 25)
    expect(second).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledWith(25, 25)
  })

  it('a second subscribe installs no second document observer or listeners', () => {
    const observers = fakeResizeObserver()
    const adds = vi.spyOn(window, 'addEventListener')
    subscribe({ onTick: vi.fn() })
    subscribe({ onTick: vi.fn() })
    expect(observers).toHaveLength(1)
    expect(adds.mock.calls.filter(([name]) => name === 'scroll')).toHaveLength(1)
    expect(adds.mock.calls.filter(([name]) => name === 'resize')).toHaveLength(1)
  })

  it('unsubscribing one of two keeps the survivor ticking; the last unsubscribe detaches', () => {
    const raf = fakeRaf()
    const gone = vi.fn()
    const survivor = vi.fn()
    const first = subscribe({ onTick: gone })
    const second = subscribe({ onTick: survivor })
    first.destroy()
    scrollTo(10)
    raf.step()
    expect(gone).not.toHaveBeenCalled()
    expect(survivor).toHaveBeenCalledWith(10, 10)
    second.destroy()
    scrollTo(50)
    raf.step()
    expect(survivor).toHaveBeenCalledTimes(1)
  })

  it('fans onSettledResize out to every live subscriber; document growth refreshes bounds only', () => {
    const observers = fakeResizeObserver()
    fakeRaf()
    const first = vi.fn()
    const second = vi.fn()
    subscribe({ onTick: vi.fn(), onSettledResize: first })
    subscribe({ onTick: vi.fn(), onSettledResize: second })
    window.dispatchEvent(new Event('resize'))
    vi.advanceTimersByTime(150)
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
    // Lazy-content growth is a bounds concern, never a measure-pass trigger.
    observers[0]?.callback([], {} as ResizeObserver)
    vi.advanceTimersByTime(150)
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('every subscribe refreshes the shared bounds — a late subscriber never clamps stale', () => {
    const raf = fakeRaf()
    const early = vi.fn()
    const late = vi.fn()
    subscribe({ onTick: early })
    // The document grew between the two boots (staggered editor upserts).
    setScrollBounds(10000, 800)
    subscribe({ onTick: late })
    scrollTo(6000)
    raf.step()
    expect(late).toHaveBeenLastCalledWith(6000, 6000)
    expect(early).toHaveBeenLastCalledWith(6000, 6000)
  })

  it('a double destroy on one subscription is safe and never tears down for the survivor', () => {
    const raf = fakeRaf()
    const survivor = vi.fn()
    const first = subscribe({ onTick: vi.fn() })
    subscribe({ onTick: survivor })
    first.destroy()
    first.destroy()
    scrollTo(10)
    raf.step()
    expect(survivor).toHaveBeenCalledWith(10, 10)
  })

  it('a fresh subscribe after refcount zero reseeds the baseline — idle scrolling never leaks in', () => {
    const raf = fakeRaf()
    const first = subscribe({ onTick: vi.fn() })
    first.destroy()
    // The page scrolls while nobody listens.
    setScroll(0, 400)
    const spy = vi.fn()
    subscribe({ onTick: spy })
    scrollTo(410)
    raf.step()
    expect(spy).toHaveBeenCalledWith(410, 10)
  })
})
