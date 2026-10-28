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
 * Orchestrator integration: the hand-stepped rAF drives scroll ticks against stubbed geometry (the
 * fixture container rect tracks scroll, so the natural position stays 0 and any scroll pins), and
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

/** A zone spanning document space 1000–1600 with a scroll-aware rect. */
const addDocZone = (
  attr: string,
  value: string,
  vars: Record<string, string> = {}
): HTMLElement => {
  const zone = document.createElement('section')
  zone.setAttribute(attr, value)
  for (const [name, varValue] of Object.entries(vars)) {
    zone.style.setProperty(name, varValue)
  }
  zone.getBoundingClientRect = () =>
    ({ top: 1000 - window.scrollY, bottom: 1600 - window.scrollY }) as DOMRect
  document.body.appendChild(zone)
  return zone
}

const addHoldZone = (): HTMLElement =>
  addDocZone('data-arts-header-zone', '', {
    '--arts-header-zone': 'hold',
    '--arts-header-zone-geometry': 'at-top'
  })

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

  it('publishes class, then attributes and the sticking callback, then the event', () => {
    const { container, onStickingChange, scrollTo } = makeSticky({
      toggleAttributes: { 'data-x': { active: 'on', inactive: 'off' } }
    })
    const stuck = (): boolean => container.classList.contains('arts-header_sticky')
    const order: string[] = []
    onStickingChange.mockImplementation((value: boolean) => {
      order.push(`callback:${value}:${stuck()}:${container.getAttribute('data-x')}`)
    })
    const fn = (e: Event): void => {
      order.push(`event:${(e as CustomEvent<IHeaderEventDetail>).detail.value}:${stuck()}`)
    }
    document.addEventListener('arts/header/sticky', fn)
    listeners.push({ name: 'arts/header/sticky', fn })
    scrollTo(50)
    expect(order).toEqual(['callback:true:true:on', 'event:true:true'])
    scrollTo(0)
    expect(order.slice(2)).toEqual(['callback:false:false:off', 'event:false:false'])
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

describe('createSticky — alternate look zones', () => {
  const ALT_CLASS = 'arts-header_alt'

  /** A hand-built alt-over zone spanning document space 1000–1600 with a scroll-aware rect. */
  const addAltZone = (): void => {
    const zone = document.createElement('section')
    zone.setAttribute('data-arts-header-alt-over', '')
    zone.getBoundingClientRect = () =>
      ({ top: 1000 - window.scrollY, bottom: 1600 - window.scrollY }) as DOMRect
    document.body.appendChild(zone)
  }

  it('publishes the alt class and event when the bar center enters an alt-over zone', () => {
    const altEvents = captureEvents('arts/header/alt')
    addAltZone()
    const { container, sticky, scrollTo } = makeSticky()
    scrollTo(959)
    expect(container.classList.contains(ALT_CLASS)).toBe(false)
    expect(altEvents).toEqual([])
    scrollTo(960)
    expect(container.classList.contains(ALT_CLASS)).toBe(true)
    expect(sticky.isAlt).toBe(true)
    expect(altEvents).toEqual([true])
    scrollTo(1560)
    expect(container.classList.contains(ALT_CLASS)).toBe(false)
    expect(sticky.isAlt).toBe(false)
    expect(altEvents).toEqual([true, false])
  })

  it('derives the decider from the pin line and bar height', () => {
    addAltZone()
    // Top pin at 20px, 80px bar: the center line sits at y + 60.
    const top = makeSticky({}, (el) => {
      el.style.position = 'sticky'
      el.style.top = '20px'
    })
    top.scrollTo(939)
    expect(top.container.classList.contains(ALT_CLASS)).toBe(false)
    top.scrollTo(940)
    expect(top.container.classList.contains(ALT_CLASS)).toBe(true)
    // Bottom pin at 0 in an 800px viewport: the center line sits at y + 800 - 0 - 40.
    const bottom = makeSticky({}, (el) => {
      el.style.position = 'sticky'
      el.style.top = 'auto'
      el.style.bottom = '0px'
    })
    bottom.scrollTo(239)
    expect(bottom.container.classList.contains(ALT_CLASS)).toBe(false)
    bottom.scrollTo(240)
    expect(bottom.container.classList.contains(ALT_CLASS)).toBe(true)
  })

  it('derives the bottom decider from a non-zero offset: viewport - offset - half the bar', () => {
    addAltZone()
    // Bottom pin at 24px, 80px bar, 800px viewport: the center line sits at y + 736.
    const { container, scrollTo } = makeSticky({}, (el) => {
      el.style.position = 'sticky'
      el.style.top = 'auto'
      el.style.bottom = '24px'
    })
    scrollTo(263)
    expect(container.classList.contains(ALT_CLASS)).toBe(false)
    scrollTo(264)
    expect(container.classList.contains(ALT_CLASS)).toBe(true)
    scrollTo(863)
    expect(container.classList.contains(ALT_CLASS)).toBe(true)
    scrollTo(864)
    expect(container.classList.contains(ALT_CLASS)).toBe(false)
  })

  it('keeps the alt class across a non-revert destroy and republishes on a fresh boot', () => {
    const altEvents = captureEvents('arts/header/alt')
    addAltZone()
    const first = makeSticky()
    first.scrollTo(1200)
    expect(altEvents).toEqual([true])
    first.sticky.destroy(false)
    expect(first.container.classList.contains(ALT_CLASS)).toBe(true)
    expect(first.sticky.isAlt).toBe(false)
    expect(altEvents).toEqual([true])
    const second = makeSticky()
    expect(second.container.classList.contains(ALT_CLASS)).toBe(true)
    expect(altEvents).toEqual([true, true])
  })

  it('clears alt and fires the event on revert destroy', () => {
    const altEvents = captureEvents('arts/header/alt')
    addAltZone()
    const { container, sticky, scrollTo } = makeSticky()
    scrollTo(1200)
    sticky.destroy(true)
    expect(container.classList.contains(ALT_CLASS)).toBe(false)
    expect(altEvents).toEqual([true, false])
  })

  it('never publishes alt when zones are disabled', () => {
    const altEvents = captureEvents('arts/header/alt')
    addAltZone()
    const { container, sticky, scrollTo } = makeSticky({ zones: false })
    scrollTo(1200)
    expect(sticky.isAlt).toBe(false)
    expect(container.classList.contains(ALT_CLASS)).toBe(false)
    expect(altEvents).toEqual([])
  })
})

describe('createSticky — at-top zones measure against the pin line', () => {
  const pinnedAt32 = (el: HTMLElement): void => {
    el.style.setProperty('--arts-header-top-pinned', '32px')
  }

  it('activates and releases an at-top zone at the admin-bar pin line, not the viewport top', () => {
    const hiddenEvents = captureEvents('arts/header/hidden')
    addDocZone('data-arts-header-hide-over', 'at-top')
    const { container, scrollTo } = makeSticky({}, pinnedAt32)
    scrollTo(967)
    expect(container.classList.contains('arts-header_hidden')).toBe(false)
    scrollTo(968)
    expect(container.classList.contains('arts-header_hidden')).toBe(true)
    scrollTo(1567)
    expect(container.classList.contains('arts-header_hidden')).toBe(true)
    scrollTo(1568)
    expect(container.classList.contains('arts-header_hidden')).toBe(false)
    expect(hiddenEvents).toEqual([true, false])
  })

  it('follows a custom top pin offset the same way', () => {
    addDocZone('data-arts-header-hide-over', 'at-top')
    const { container, scrollTo } = makeSticky({}, (el) => {
      el.style.position = 'sticky'
      el.style.top = '88px'
    })
    scrollTo(911)
    expect(container.classList.contains('arts-header_hidden')).toBe(false)
    scrollTo(912)
    expect(container.classList.contains('arts-header_hidden')).toBe(true)
  })

  it('uses line 0 for a bottom pin, whatever the admin-bar allowance', () => {
    addDocZone('data-arts-header-hide-over', 'at-top')
    const { container, scrollTo } = makeSticky({}, (el) => {
      pinnedAt32(el)
      el.style.position = 'sticky'
      el.style.top = 'auto'
      el.style.bottom = '24px'
    })
    // Neither the 32px allowance (968) nor the 24px bottom offset (976) moves the line.
    scrollTo(968)
    expect(container.classList.contains('arts-header_hidden')).toBe(false)
    scrollTo(976)
    expect(container.classList.contains('arts-header_hidden')).toBe(false)
    scrollTo(999)
    expect(container.classList.contains('arts-header_hidden')).toBe(false)
    scrollTo(1000)
    expect(container.classList.contains('arts-header_hidden')).toBe(true)
  })
})

describe('createSticky — hold zones', () => {
  const HELD = 'arts-header_held'
  const LOCKED = 'arts-header_locked'

  it('publishes held and the lock it implies, and keeps the sticky class on', () => {
    const heldEvents = captureEvents('arts/header/held')
    const lockedEvents = captureEvents('arts/header/locked')
    addHoldZone()
    const { container, sticky, scrollTo } = makeSticky()
    scrollTo(999)
    expect(container.classList.contains(HELD)).toBe(false)
    expect(heldEvents).toEqual([])
    scrollTo(1000)
    expect(container.classList.contains(HELD)).toBe(true)
    expect(container.classList.contains(LOCKED)).toBe(true)
    // `_sticky` positions the bar in the fixed modes too — only the sticky LOOK is turned off.
    expect(container.classList.contains('arts-header_sticky')).toBe(true)
    expect(sticky.isHeld).toBe(true)
    expect(sticky.isLocked).toBe(true)
    expect(heldEvents).toEqual([true])
    expect(lockedEvents).toEqual([true])
    scrollTo(1600)
    expect(container.classList.contains(HELD)).toBe(false)
    expect(container.classList.contains(LOCKED)).toBe(false)
    expect(sticky.isHeld).toBe(false)
    expect(heldEvents).toEqual([true, false])
    expect(lockedEvents).toEqual([true, false])
  })

  it('does not hold for a plain lock zone', () => {
    const heldEvents = captureEvents('arts/header/held')
    addDocZone('data-arts-header-lock-over', 'at-top')
    const { container, scrollTo } = makeSticky()
    scrollTo(1200)
    expect(container.classList.contains(LOCKED)).toBe(true)
    expect(container.classList.contains(HELD)).toBe(false)
    expect(heldEvents).toEqual([])
  })

  it('keeps an API lock after the hold zone ends', () => {
    const heldEvents = captureEvents('arts/header/held')
    const lockedEvents = captureEvents('arts/header/locked')
    addHoldZone()
    const { container, sticky, scrollTo } = makeSticky()
    sticky.setLocked(true)
    scrollTo(1200)
    scrollTo(1700)
    expect(container.classList.contains(HELD)).toBe(false)
    expect(sticky.isLocked).toBe(true)
    expect(heldEvents).toEqual([true, false])
    expect(lockedEvents).toEqual([true])
  })

  it('re-fires the sticking callback once per held flip while stuck — the bar animates', () => {
    addHoldZone()
    const { scrollTo, onStickingChange } = makeSticky()
    scrollTo(500)
    expect(onStickingChange.mock.calls).toEqual([[true]])
    scrollTo(1000)
    expect(onStickingChange.mock.calls).toEqual([[true], [true]])
    scrollTo(1300)
    expect(onStickingChange).toHaveBeenCalledTimes(2)
    scrollTo(1600)
    expect(onStickingChange).toHaveBeenCalledTimes(3)
  })

  it('stays quiet on the sticking callback for a held flip while the bar is not stuck', () => {
    addHoldZone()
    // The header's own slot sits at document y 1000: exactly at the pin line it is not yet stuck.
    const { container, sticky, scrollTo, onStickingChange } = makeSticky({}, (el) => {
      el.getBoundingClientRect = () =>
        ({ top: 1000 - window.scrollY, bottom: 1080 - window.scrollY, height: 80 }) as DOMRect
    })
    scrollTo(1000)
    expect(sticky.isSticking).toBe(false)
    expect(container.classList.contains(HELD)).toBe(true)
    expect(onStickingChange).not.toHaveBeenCalled()
  })

  it('publishes the held class, then the sticking callback, then the event', () => {
    addHoldZone()
    const { container, onStickingChange, scrollTo } = makeSticky()
    scrollTo(500)
    const order: string[] = []
    const held = (): boolean => container.classList.contains(HELD)
    onStickingChange.mockImplementation(() => {
      order.push(`callback:${held()}`)
    })
    const fn = (e: Event): void => {
      order.push(`event:${(e as CustomEvent<IHeaderEventDetail>).detail.value}:${held()}`)
    }
    document.addEventListener('arts/header/held', fn)
    listeners.push({ name: 'arts/header/held', fn })
    scrollTo(1000)
    expect(order).toEqual(['callback:true', 'event:true:true'])
    scrollTo(1600)
    expect(order.slice(2)).toEqual(['callback:false', 'event:false:false'])
  })

  it('clears with its events on destroy(true) and keeps the class on destroy(false)', () => {
    const heldEvents = captureEvents('arts/header/held')
    addHoldZone()
    const reverted = makeSticky()
    reverted.scrollTo(1200)
    reverted.sticky.destroy(true)
    expect(reverted.container.classList.contains(HELD)).toBe(false)
    expect(heldEvents).toEqual([true, false])

    const kept = makeSticky()
    expect(kept.container.classList.contains(HELD)).toBe(true)
    kept.sticky.destroy(false)
    expect(kept.container.classList.contains(HELD)).toBe(true)
    expect(kept.sticky.isHeld).toBe(false)
    expect(heldEvents).toEqual([true, false, true])
  })
})

describe('createSticky — API lock vs zone lock', () => {
  const LOCKED = 'arts-header_locked'

  it('keeps an API lock through entering and leaving a lock zone', () => {
    const lockedEvents = captureEvents('arts/header/locked')
    addDocZone('data-arts-header-lock-over', 'at-top')
    const { container, sticky, scrollTo } = makeSticky()
    sticky.setLocked(true)
    scrollTo(1200)
    scrollTo(1700)
    expect(sticky.isLocked).toBe(true)
    expect(container.classList.contains(LOCKED)).toBe(true)
    sticky.setLocked(false)
    expect(sticky.isLocked).toBe(false)
    expect(container.classList.contains(LOCKED)).toBe(false)
    expect(lockedEvents).toEqual([true, false])
  })

  it('keeps a zone lock through an API unlock inside the zone', () => {
    const lockedEvents = captureEvents('arts/header/locked')
    addDocZone('data-arts-header-lock-over', 'at-top')
    const { container, sticky, scrollTo } = makeSticky()
    scrollTo(1200)
    sticky.setLocked(true)
    sticky.setLocked(false)
    expect(sticky.isLocked).toBe(true)
    expect(container.classList.contains(LOCKED)).toBe(true)
    scrollTo(1700)
    expect(sticky.isLocked).toBe(false)
    expect(lockedEvents).toEqual([true, false])
  })
})

describe('createSticky — sticky until', () => {
  const RELEASED = 'arts-header_released'
  const RELEASE_VAR = '--arts-header-release-top'

  /** An in-flow boundary at document y 1000 with a scroll-aware rect. */
  const addBoundary = (): HTMLElement => {
    const boundary = document.createElement('section')
    boundary.className = 'until-boundary'
    boundary.getBoundingClientRect = () =>
      ({ top: 1000 - window.scrollY, bottom: 1500 - window.scrollY }) as DOMRect
    document.body.appendChild(boundary)
    return boundary
  }

  it.each([
    ['selector', (): string => '.until-boundary'],
    ['element', (boundary: HTMLElement): HTMLElement => boundary]
  ])('releases where the bar bottom reaches the boundary (%s)', (_form, toUntil) => {
    const releasedEvents = captureEvents('arts/header/released')
    const boundary = addBoundary()
    const { container, sticky, scrollTo } = makeSticky({ until: toUntil(boundary) })
    scrollTo(919)
    expect(container.classList.contains(RELEASED)).toBe(false)
    scrollTo(920)
    expect(container.classList.contains(RELEASED)).toBe(true)
    expect(sticky.isReleased).toBe(true)
    expect(container.style.getPropertyValue(RELEASE_VAR)).toBe('920px')
    expect(releasedEvents).toEqual([true])
    scrollTo(500)
    expect(container.classList.contains(RELEASED)).toBe(false)
    expect(sticky.isReleased).toBe(false)
    expect(container.style.getPropertyValue(RELEASE_VAR)).toBe('')
    expect(releasedEvents).toEqual([true, false])
  })

  it('has the class and the anchor var in place by the time the event fires', () => {
    addBoundary()
    const { container, scrollTo } = makeSticky({ until: '.until-boundary' })
    const seen: string[] = []
    const fn = (): void => {
      seen.push(
        `${container.classList.contains(RELEASED)}:${container.style.getPropertyValue(RELEASE_VAR)}`
      )
    }
    document.addEventListener('arts/header/released', fn)
    listeners.push({ name: 'arts/header/released', fn })
    scrollTo(950)
    expect(seen).toEqual(['true:950px'])
  })

  it('freezes the reveal direction while released — the bar scrolls off as it is', () => {
    addBoundary()
    const { container, scrollTo } = makeSticky({ until: '.until-boundary' })
    scrollTo(120)
    scrollTo(950)
    expect(container.classList.contains('arts-header_scrolling-down')).toBe(true)
    // Still released, moving up: an ungated tick would flip to revealing here.
    scrollTo(930)
    expect(container.classList.contains(RELEASED)).toBe(true)
    expect(container.classList.contains('arts-header_scrolling-down')).toBe(true)
    expect(container.classList.contains('arts-header_revealing')).toBe(false)
  })

  it('still clears the released class and anchor on destroy(false), without an event', () => {
    const releasedEvents = captureEvents('arts/header/released')
    addBoundary()
    const { container, sticky, scrollTo } = makeSticky({ until: '.until-boundary' })
    scrollTo(950)
    sticky.destroy(false)
    expect(container.classList.contains(RELEASED)).toBe(false)
    expect(container.style.getPropertyValue(RELEASE_VAR)).toBe('')
    expect(sticky.isReleased).toBe(false)
    // The rest of the visual state is kept for the AJAX hand-off.
    expect(container.classList.contains('arts-header_sticky')).toBe(true)
    expect(releasedEvents).toEqual([true])
  })

  it('fires the released event on destroy(true)', () => {
    const releasedEvents = captureEvents('arts/header/released')
    addBoundary()
    const { container, sticky, scrollTo } = makeSticky({ until: '.until-boundary' })
    scrollTo(950)
    sticky.destroy(true)
    expect(container.classList.contains(RELEASED)).toBe(false)
    expect(container.style.getPropertyValue(RELEASE_VAR)).toBe('')
    expect(releasedEvents).toEqual([true, false])
  })

  it('warns once for a selector that matches nothing, and never releases', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { container, sticky, scrollTo } = makeSticky({ until: '.missing' })
    scrollTo(4000)
    sticky.update()
    expect(container.classList.contains(RELEASED)).toBe(false)
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      ':Header [WARN] sticky.until selector matched nothing',
      '.missing'
    )
  })
})

describe('createSticky — trigger', () => {
  const STICKY = 'arts-header_sticky'
  let triggerTop = 400

  /** A trigger element at document y `triggerTop`, with a scroll-aware rect. */
  const addTrigger = (): HTMLElement => {
    const trigger = document.createElement('div')
    trigger.className = 'pin-trigger'
    trigger.getBoundingClientRect = () => ({ top: triggerTop - window.scrollY }) as DOMRect
    document.body.appendChild(trigger)
    return trigger
  }

  beforeEach(() => {
    triggerTop = 400
  })

  it.each([
    ['selector', (): string => '.pin-trigger'],
    ['element', (trigger: HTMLElement): HTMLElement => trigger]
  ])('pins against the trigger position instead of the wrapper slot (%s)', (_form, toTrigger) => {
    const trigger = addTrigger()
    const { container, scrollTo } = makeSticky({ trigger: toTrigger(trigger) })
    scrollTo(400)
    expect(container.classList.contains(STICKY)).toBe(false)
    scrollTo(401)
    expect(container.classList.contains(STICKY)).toBe(true)
  })

  it('re-reads the trigger position on update()', () => {
    const { container, sticky, scrollTo } = makeSticky({ trigger: addTrigger() })
    scrollTo(401)
    expect(container.classList.contains(STICKY)).toBe(true)
    triggerTop = 600
    sticky.update()
    expect(container.classList.contains(STICKY)).toBe(false)
  })

  it('warns once for a selector that matches nothing and falls back to the wrapper slot', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { container, scrollTo } = makeSticky({ trigger: '.missing' })
    scrollTo(2)
    expect(container.classList.contains(STICKY)).toBe(true)
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      ':Header [WARN] sticky.trigger selector matched nothing',
      '.missing'
    )
  })
})

describe('createSticky — reveal offset property registration', () => {
  it('leaves the default var to the stylesheet — a JS registration costs a document recalc', () => {
    const registerProperty = vi.fn()
    vi.stubGlobal('CSS', { registerProperty })
    makeSticky()
    expect(registerProperty).not.toHaveBeenCalled()
  })

  it('registers a custom var name as an inheriting length, once per instance', () => {
    const registerProperty = vi.fn()
    vi.stubGlobal('CSS', { registerProperty })
    makeSticky({}, undefined, { vars: { revealOffset: '--custom-offset' } })
    expect(registerProperty).toHaveBeenCalledExactlyOnceWith({
      name: '--custom-offset',
      syntax: '<length>',
      inherits: true,
      initialValue: '0px'
    })
  })

  it('never registers when the reveal is off', () => {
    const registerProperty = vi.fn()
    vi.stubGlobal('CSS', { registerProperty })
    makeSticky({ reveal: false }, undefined, { vars: { revealOffset: '--custom-offset' } })
    expect(registerProperty).not.toHaveBeenCalled()
  })

  it('boots a second instance on the same custom name — the duplicate throw is swallowed', () => {
    const registerProperty = vi.fn(() => {
      throw new DOMException('already registered', 'InvalidModificationError')
    })
    vi.stubGlobal('CSS', { registerProperty })
    expect(() => {
      makeSticky({}, undefined, { vars: { revealOffset: '--custom-offset' } })
      makeSticky({}, undefined, { vars: { revealOffset: '--custom-offset' } })
    }).not.toThrow()
    expect(registerProperty).toHaveBeenCalledTimes(2)
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

  describe('bottom-pinned flow header', () => {
    /**
     * Viewport 800, bottom offset 0, slot at document y 1000, rest height 140: stuck while
     * `1000 - y >= 800 - pinnedHeight`. Boots un-stuck at y 500 so the rest height is captured.
     */
    const makeBottomPinned = (config?: Parameters<typeof resolveConfig>[0]) => {
      let barHeight = 140
      setScroll(0, 500)
      const rig = makeSticky(
        {},
        (container) => {
          container.style.position = 'sticky'
          container.style.top = 'auto'
          container.style.bottom = '0px'
          // Pinned, the wrapper rides the viewport bottom: only its previous sibling knows the slot.
          container.getBoundingClientRect = () => {
            const top = Math.min(1000 - window.scrollY, 660)
            return { top, bottom: top + 140, height: 140 } as DOMRect
          }
          const sibling = document.createElement('div')
          sibling.getBoundingClientRect = () => ({ bottom: 1000 - window.scrollY }) as DOMRect
          container.before(sibling)
          const bar = container.firstElementChild as HTMLElement
          bar.getBoundingClientRect = () => ({ height: barHeight }) as DOMRect
        },
        config
      )
      const shrinkTo = (height: number): void => {
        barHeight = height
        settleBarResize(rig.ro)
      }
      return { ...rig, shrinkTo }
    }

    it('stays stuck on the slot height when sticky styling shrinks the bar', () => {
      const { container, sticky, scrollTo, shrinkTo } = makeBottomPinned()
      expect(sticky.isSticking).toBe(false)
      expect(container.style.getPropertyValue(NATURAL_VAR)).toBe('140px')
      scrollTo(320)
      expect(sticky.isSticking).toBe(true)
      // On the live 100px height the line would be 700 and 1000 - 320 = 680 would fall short.
      shrinkTo(100)
      expect(sticky.isSticking).toBe(true)
      expect(container.style.getPropertyValue(NATURAL_VAR)).toBe('140px')
    })

    it('measures against the live bar height once the slot var is opted out', () => {
      const { sticky, scrollTo, shrinkTo } = makeBottomPinned({ vars: { naturalHeight: '' } })
      scrollTo(320)
      expect(sticky.isSticking).toBe(true)
      shrinkTo(100)
      expect(sticky.isSticking).toBe(false)
    })
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

  it('is idempotent — a second destroy tears nothing down twice', () => {
    const stickyEvents = captureEvents('arts/header/sticky')
    const { sticky, scrollTo, ro, mo } = makeSticky()
    const barRecord = ro.find((o) => o.observed.some((e) => e.target !== document.documentElement))
    const zoneRecord = mo.find((o) => o.observed.some((e) => e.target === document.body))
    scrollTo(50)
    sticky.destroy(true)
    sticky.destroy(true)
    sticky.destroy(false)
    expect(barRecord?.disconnectCount).toBe(1)
    expect(zoneRecord?.disconnectCount).toBe(1)
    expect(stickyEvents).toEqual([true, false])
  })

  it('a repeated destroy leaves the shared scroll bus running for the other instances', () => {
    const first = makeSticky()
    const second = makeSticky()
    first.sticky.destroy(true)
    first.sticky.destroy(true)
    second.scrollTo(50)
    expect(second.container.classList.contains('arts-header_sticky')).toBe(true)
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
