// @vitest-environment happy-dom
import type { IHeaderEventDetail, IResolvedStickyOptions } from '@ts/interfaces'
import { resolveConfig } from '@ts/options/resolveConfig'
import { createSticky } from '@ts/sticky/createSticky'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fakeMutationObserver,
  fakeRaf,
  fakeResizeObserver,
  makeHeaderFixture,
  setScroll,
  setScrollBounds
} from '../support'

/**
 * Orchestrator integration: the hand-stepped rAF drives scroll ticks against stubbed geometry
 * (the fixture container rect reads zeros, so the natural position is 0 and any scroll pins), and
 * the assertions read the published classes/events — the same surface CSS and consumers key on.
 */

const listeners: { name: string; fn: EventListener }[] = []
const captureEvents = (name: string): boolean[] => {
  const seen: boolean[] = []
  const fn = (e: Event): void => {
    seen.push((e as CustomEvent<IHeaderEventDetail>).detail.value)
  }
  document.addEventListener(name, fn)
  listeners.push({ name, fn })
  return seen
}

/** Each rig registers real window listeners — destroy them or the previous test keeps ticking. */
const created: { destroy(revert: boolean): void }[] = []

beforeEach(() => {
  setScrollBounds(5000, 800)
  setScroll(0, 0)
})

afterEach(() => {
  for (const sticky of created) {
    sticky.destroy(false)
  }
  created.length = 0
  for (const { name, fn } of listeners) {
    document.removeEventListener(name, fn)
  }
  listeners.length = 0
  document.body.innerHTML = ''
})

const makeSticky = (
  overrides: Partial<IResolvedStickyOptions> = {},
  prepare?: (container: HTMLElement) => void,
  config?: Parameters<typeof resolveConfig>[0]
) => {
  const mo = fakeMutationObserver()
  const ro = fakeResizeObserver()
  const raf = fakeRaf()
  const { container, bar } = makeHeaderFixture(80)
  prepare?.(container)
  const onStickingChange = vi.fn()
  const sticky = createSticky({
    container,
    bar,
    options: {
      trigger: undefined,
      reveal: true,
      until: undefined,
      toggleAttributes: false,
      zones: true,
      ...overrides
    },
    config: resolveConfig(config),
    onStickingChange
  })
  created.push(sticky)
  const scrollTo = (y: number): void => {
    setScroll(0, y)
    window.dispatchEvent(new Event('scroll'))
    raf.step()
  }
  return { container, bar, sticky, scrollTo, onStickingChange, mo, ro, raf }
}

describe('createSticky — pin publishing', () => {
  it('publishes the pin from the scroll tick: class, event, getter, internal signal', () => {
    const stickyEvents = captureEvents('arts/header/sticky')
    const { container, sticky, scrollTo, onStickingChange } = makeSticky()
    scrollTo(50)
    expect(container.classList.contains('arts-header_sticky')).toBe(true)
    expect(sticky.isSticking).toBe(true)
    expect(stickyEvents).toEqual([true])
    expect(onStickingChange).toHaveBeenCalledWith(true)
    scrollTo(0)
    expect(container.classList.contains('arts-header_sticky')).toBe(false)
    expect(stickyEvents).toEqual([true, false])
  })

  // A header sitting under the admin bar: doc slot at the bar's height, not 0.
  const underAdminBar = (el: HTMLElement): void => {
    el.getBoundingClientRect = () =>
      ({ top: 46 - window.scrollY, bottom: 126 - window.scrollY, height: 80 }) as DOMRect
  }

  it('pins where the bar clears when the admin bar is document-anchored (<=600px)', () => {
    const { container, scrollTo } = makeSticky({}, (el) => {
      underAdminBar(el)
      el.style.setProperty('--arts-header-top-pinned', '0px')
    })
    scrollTo(20)
    expect(container.classList.contains('arts-header_sticky')).toBe(false)
    scrollTo(47)
    expect(container.classList.contains('arts-header_sticky')).toBe(true)
  })

  it('pins at the bar line while the admin bar is still viewport-pinned', () => {
    const { container, scrollTo } = makeSticky({}, (el) => {
      underAdminBar(el)
      el.style.setProperty('--arts-header-top-pinned', '46px')
    })
    scrollTo(2)
    expect(container.classList.contains('arts-header_sticky')).toBe(true)
  })

  it('multiple instances share ONE scroll tick — a scroll event schedules a single rAF', () => {
    const first = makeSticky()
    const second = makeSticky()
    setScroll(0, 50)
    window.dispatchEvent(new Event('scroll'))
    expect(second.raf.pendingCount).toBe(1)
    second.raf.step()
    // Both published the pin from the one shared tick.
    expect(first.container.classList.contains('arts-header_sticky')).toBe(true)
    expect(second.container.classList.contains('arts-header_sticky')).toBe(true)
  })

  it('evaluates the boot state synchronously — a scroll-restored load publishes at construction', () => {
    setScroll(0, 500)
    const { container, sticky } = makeSticky()
    expect(container.classList.contains('arts-header_sticky')).toBe(true)
    expect(sticky.isSticking).toBe(true)
  })

  it('marks a reveal-less pin displaced immediately', () => {
    const displacedEvents = captureEvents('arts/header/displaced')
    const { scrollTo } = makeSticky({ reveal: false })
    scrollTo(50)
    expect(displacedEvents).toEqual([true])
    scrollTo(0)
    expect(displacedEvents).toEqual([true, false])
  })

  it('stops publishing after destroy — the tick source is gone', () => {
    const { container, sticky, scrollTo } = makeSticky()
    sticky.destroy(true)
    scrollTo(300)
    expect(container.classList.contains('arts-header_sticky')).toBe(false)
  })
})

describe('createSticky — auto-hide', () => {
  it('drives direction classes and the displaced signal from scroll ticks', () => {
    const displacedEvents = captureEvents('arts/header/displaced')
    const { container, sticky, scrollTo } = makeSticky()
    scrollTo(120)
    expect(container.classList.contains('arts-header_scrolling-down')).toBe(true)
    expect(sticky.isDisplaced).toBe(true)
    scrollTo(80)
    expect(container.classList.contains('arts-header_revealing')).toBe(true)
    expect(container.classList.contains('arts-header_scrolling-down')).toBe(false)
    expect(displacedEvents).toEqual([true, false])
  })

  it('freezes direction handling while locked, and un-pinning resets the direction classes', () => {
    const { container, sticky, scrollTo } = makeSticky()
    scrollTo(120)
    expect(container.classList.contains('arts-header_scrolling-down')).toBe(true)
    scrollTo(80)
    expect(container.classList.contains('arts-header_scrolling-down')).toBe(false)
    // A lock freezes the CURRENT direction state — new ticks must not flip it back.
    sticky.setLocked(true)
    scrollTo(300)
    expect(container.classList.contains('arts-header_scrolling-down')).toBe(false)
    sticky.setLocked(false)
    scrollTo(400)
    expect(container.classList.contains('arts-header_scrolling-down')).toBe(true)
    scrollTo(0)
    expect(container.classList.contains('arts-header_sticky')).toBe(false)
    expect(container.classList.contains('arts-header_scrolling-down')).toBe(false)
  })

  it('locking clears the frozen direction state so the revealed bar keeps its sticky styling', () => {
    const displacedEvents = captureEvents('arts/header/displaced')
    const { container, sticky, scrollTo } = makeSticky()
    scrollTo(120)
    expect(container.classList.contains('arts-header_scrolling-down')).toBe(true)
    expect(sticky.isDisplaced).toBe(true)
    // Lock reveals the bar (the hide rule exempts `_locked`); a frozen `_scrolling-down` would
    // keep the sticky style scope (`:not(_scrolling-down)`) from applying to a visibly shown bar.
    sticky.setLocked(true)
    expect(container.classList.contains('arts-header_scrolling-down')).toBe(false)
    expect(container.classList.contains('arts-header_revealing')).toBe(false)
    expect(sticky.isDisplaced).toBe(false)
    expect(displacedEvents).toEqual([true, false])
  })

  it('swaps configured toggle attributes between the class write and the event', () => {
    const seenAtEvent: (string | null)[] = []
    const fn = (): void => {
      seenAtEvent.push(document.querySelector('.js-arts-header')?.getAttribute('data-x') ?? null)
    }
    document.addEventListener('arts/header/sticky', fn)
    listeners.push({ name: 'arts/header/sticky', fn })
    const { scrollTo } = makeSticky({
      toggleAttributes: { 'data-x': { active: 'on', inactive: 'off' } }
    })
    scrollTo(50)
    expect(seenAtEvent).toEqual(['on'])
    scrollTo(0)
    expect(seenAtEvent).toEqual(['on', 'off'])
  })

  it('gates the hide by the reveal offset read from the CSS var at construction', () => {
    const { container, scrollTo } = makeSticky({}, (el) => {
      el.style.setProperty('--arts-header-reveal-offset', '200px')
    })
    scrollTo(150)
    // Inside the 200px offset slack: a downward move must NOT hide.
    expect(container.classList.contains('arts-header_scrolling-down')).toBe(false)
    scrollTo(300)
    expect(container.classList.contains('arts-header_scrolling-down')).toBe(true)
  })

  it('re-measures the reveal offset on a settled window resize (vh offsets track the viewport)', () => {
    const { container, scrollTo } = makeSticky()
    scrollTo(150)
    expect(container.classList.contains('arts-header_scrolling-down')).toBe(true)
    scrollTo(20)
    expect(container.classList.contains('arts-header_scrolling-down')).toBe(false)
    container.style.setProperty('--arts-header-reveal-offset', '500px')
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    window.dispatchEvent(new Event('resize'))
    vi.advanceTimersByTime(150)
    vi.useRealTimers()
    scrollTo(200)
    // Within the new 500px slack: no hide.
    expect(container.classList.contains('arts-header_scrolling-down')).toBe(false)
  })

  it('observes no document-root mutations — height-var propagation is callback-wired', () => {
    const { mo } = makeSticky()
    const rootObservers = mo.filter((o) =>
      o.observed.some((e) => e.target === document.documentElement)
    )
    expect(rootObservers).toHaveLength(0)
  })

  it('re-runs the measurement pass on a settled bar resize — late-injected styles resize the bar after boot', () => {
    const { container, scrollTo, ro } = makeSticky()
    const barRecord = ro.find((o) => o.observed.some((e) => e.target !== document.documentElement))
    expect(barRecord).toBeDefined()
    // The page also grew; the bar-driven update() must refresh the scroll bounds along the way.
    setScrollBounds(10000, 800)
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    barRecord?.callback([], {} as ResizeObserver)
    vi.advanceTimersByTime(150)
    vi.useRealTimers()
    scrollTo(4500)
    scrollTo(6000)
    scrollTo(5000)
    // With stale bounds both later positions clamp to 4200 (delta 0, reveal starves); with the
    // refreshed max the last tick is a genuine upward move.
    expect(container.classList.contains('arts-header_scrolling-down')).toBe(false)
    expect(container.classList.contains('arts-header_revealing')).toBe(true)
  })

  it('a measure pass never evaluates zones at a stale position — no transient event burst', () => {
    const hiddenEvents = captureEvents('arts/header/hidden')
    let zoneTop = 1000
    let zoneBottom = 2500
    const zone = document.createElement('section')
    zone.setAttribute('data-arts-header-hide-over', 'at-top')
    zone.getBoundingClientRect = () =>
      ({ top: zoneTop - window.scrollY, bottom: zoneBottom - window.scrollY }) as DOMRect
    document.body.appendChild(zone)
    const { ro } = makeSticky()
    // The page scrolled but the coalesced tick has not run yet (rAF still pending), and the
    // content reflowed the zone over the OLD position — the settle debounce fires first.
    setScroll(0, 1500)
    zoneTop = -10
    zoneBottom = 500
    const barRecord = ro.find((o) => o.observed.some((e) => e.target !== document.documentElement))
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    barRecord?.callback([], {} as ResizeObserver)
    vi.advanceTimersByTime(150)
    vi.useRealTimers()
    // Evaluating the rescanned rects at the stale tick position would emit a [true, false] burst.
    expect(hiddenEvents).toEqual([])
  })

  it('creates no zone machinery when zones are disabled — a secondary header ignores zone attrs', () => {
    const { sticky, mo } = makeSticky({ zones: false })
    const bodyObservers = mo.filter((o) => o.observed.some((e) => e.target === document.body))
    expect(bodyObservers).toHaveLength(0)
    expect(() => sticky.refreshZones()).not.toThrow()
  })
})

describe('createSticky — natural-height slot var', () => {
  const NATURAL_VAR = '--arts-header-natural-height'

  /** Fire the bar ResizeObserver and let the debounced measure pass settle. */
  const settleBarResize = (ro: ReturnType<typeof fakeResizeObserver>): void => {
    const barRecord = ro.find((o) => o.observed.some((e) => e.target !== document.documentElement))
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    barRecord?.callback([], {} as ResizeObserver)
    vi.advanceTimersByTime(150)
    vi.useRealTimers()
  }

  it('writes the rest height to the wrapper var at an un-stuck boot', () => {
    const { container } = makeSticky()
    expect(container.style.getPropertyValue(NATURAL_VAR)).toBe('80px')
  })

  it('freezes the var while stuck, and refreshes it on the next un-stuck settled pass', () => {
    const { container, bar, scrollTo, ro } = makeSticky()
    scrollTo(50)
    // Sticky styling shrinks the bar; the settled measure pass must NOT touch the slot.
    bar.getBoundingClientRect = () => ({ height: 60 }) as DOMRect
    settleBarResize(ro)
    expect(container.style.getPropertyValue(NATURAL_VAR)).toBe('80px')
    // Back at rest the bar settles at a NEW rest height — the slot follows.
    scrollTo(0)
    bar.getBoundingClientRect = () => ({ height: 90 }) as DOMRect
    settleBarResize(ro)
    expect(container.style.getPropertyValue(NATURAL_VAR)).toBe('90px')
  })

  it('never writes from the tick path — scroll ticks do arithmetic only', () => {
    let setPropertySpy: ReturnType<typeof vi.spyOn> | undefined
    const { scrollTo } = makeSticky({}, (container) => {
      setPropertySpy = vi.spyOn(container.style, 'setProperty')
    })
    const bootWrites = setPropertySpy?.mock.calls.length
    scrollTo(50)
    scrollTo(120)
    scrollTo(0)
    scrollTo(0)
    expect(setPropertySpy?.mock.calls.length).toBe(bootWrites)
  })

  it('skips writes entirely when the config var is the empty-string opt-out', () => {
    const { container } = makeSticky({}, undefined, { vars: { naturalHeight: '' } })
    expect(container.getAttribute('style') ?? '').toBe('')
  })

  it('never writes while booted stuck — no rest height is measurable yet', () => {
    setScroll(0, 500)
    const { container } = makeSticky()
    expect(container.style.getPropertyValue(NATURAL_VAR)).toBe('')
  })

  it('keeps the var on destroy(false) and removes it on destroy(true)', () => {
    const kept = makeSticky()
    kept.sticky.destroy(false)
    expect(kept.container.style.getPropertyValue(NATURAL_VAR)).toBe('80px')

    const reverted = makeSticky()
    reverted.sticky.destroy(true)
    expect(reverted.container.style.getPropertyValue(NATURAL_VAR)).toBe('')
  })
})

describe('createSticky — destroy', () => {
  it('keeps the visual state on destroy(revert=false) while forgetting the values', () => {
    const stickyEvents = captureEvents('arts/header/sticky')
    const { container, sticky, scrollTo } = makeSticky()
    scrollTo(50)
    sticky.destroy(false)
    expect(container.classList.contains('arts-header_sticky')).toBe(true)
    expect(sticky.isSticking).toBe(false)
    expect(stickyEvents).toEqual([true])
  })

  it('restores the DOM and fires the state events on destroy(revert=true)', () => {
    const stickyEvents = captureEvents('arts/header/sticky')
    const hiddenEvents = captureEvents('arts/header/hidden')
    const { container, sticky, scrollTo } = makeSticky()
    scrollTo(50)
    sticky.setHidden(true)
    sticky.destroy(true)
    expect(container.classList.contains('arts-header_sticky')).toBe(false)
    expect(container.classList.contains('arts-header_hidden')).toBe(false)
    expect(stickyEvents).toEqual([true, false])
    expect(hiddenEvents).toEqual([true, false])
  })

  it('is idempotent', () => {
    const { sticky } = makeSticky()
    sticky.destroy(true)
    expect(() => sticky.destroy(true)).not.toThrow()
  })

  it('a measure pass pending at destroy never lands — no rescans, no class writes', () => {
    const hiddenEvents = captureEvents('arts/header/hidden')
    const zone = document.createElement('section')
    zone.setAttribute('data-arts-header-hide-over', 'at-top')
    // Inactive: sits far below every position this test visits.
    zone.getBoundingClientRect = () => ({ top: 100000, bottom: 100500 }) as DOMRect
    document.body.appendChild(zone)
    const { container, sticky, ro } = makeSticky()
    const barRecord = ro.find((o) => o.observed.some((e) => e.target !== document.documentElement))
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    // The bar resize arms the settled measure pass; destroy lands before it fires.
    barRecord?.callback([], {} as ResizeObserver)
    sticky.destroy(true)
    // An AJAX swap replaced the page content — the zone now covers the top of the new page.
    zone.getBoundingClientRect = () => ({ top: -10, bottom: 500 }) as DOMRect
    vi.advanceTimersByTime(300)
    vi.useRealTimers()
    expect(container.classList.contains('arts-header_hidden')).toBe(false)
    expect(hiddenEvents).toEqual([])
  })
})
