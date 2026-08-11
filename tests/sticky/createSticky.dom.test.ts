// @vitest-environment happy-dom
import type { IHeaderEventDetail, IResolvedStickyOptions } from '@ts/interfaces'
import { resolveConfig } from '@ts/options/config'
import { createSticky } from '@ts/sticky/createSticky'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  fakeIntersectionObserver,
  fakeMutationObserver,
  fakeRaf,
  makeHeaderFixture,
  setScroll,
  setScrollBounds
} from '../support'

/**
 * Orchestrator integration: stubbed observers deliver crossings, the hand-stepped rAF drives
 * scroll ticks, and the assertions read the published classes/events — the same surface CSS and
 * consumers key on. The stick observer is always the first IntersectionObserver instance (until
 * has no boundary here; zones scan later and find no zones).
 */

const stickEntry = (isIntersecting: boolean, top: number) =>
  ({ isIntersecting, boundingClientRect: { top } }) as IntersectionObserverEntry

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

const makeSticky = (overrides: Partial<IResolvedStickyOptions> = {}) => {
  const io = fakeIntersectionObserver()
  fakeMutationObserver()
  const raf = fakeRaf()
  const { container, bar } = makeHeaderFixture(80)
  const sticky = createSticky({
    container,
    bar,
    options: {
      trigger: undefined,
      reveal: { mode: 'auto-hide', offset: 0 },
      until: undefined,
      toggleAttributes: false,
      ...overrides
    },
    config: resolveConfig()
  })
  created.push(sticky)
  const observer = {} as IntersectionObserver
  const deliverStick = (isIntersecting: boolean, top: number): void => {
    io[0]?.callback([stickEntry(isIntersecting, top)], observer)
  }
  const scrollTo = (y: number): void => {
    setScroll(0, y)
    window.dispatchEvent(new Event('scroll'))
    raf.step()
  }
  return { container, bar, sticky, deliverStick, scrollTo }
}

describe('createSticky — auto-hide', () => {
  it('publishes the stick immediately at the crossing: class, event, getter, internal signal', () => {
    const stickyEvents = captureEvents('arts/header/sticky')
    const { container, sticky, deliverStick } = makeSticky()
    const internal: boolean[] = []
    sticky.on('change', (v) => internal.push(v))
    deliverStick(false, -5)
    expect(container.classList.contains('arts-header_sticky')).toBe(true)
    expect(sticky.isSticking).toBe(true)
    expect(stickyEvents).toEqual([true])
    expect(internal).toEqual([true])
  })

  it('drives direction classes and the displaced signal from scroll ticks', () => {
    const displacedEvents = captureEvents('arts/header/displaced')
    const { container, sticky, deliverStick, scrollTo } = makeSticky()
    deliverStick(false, -5)
    scrollTo(120)
    expect(container.classList.contains('arts-header_scrolling-down')).toBe(true)
    expect(sticky.isDisplaced).toBe(true)
    scrollTo(80)
    expect(container.classList.contains('arts-header_revealing')).toBe(true)
    expect(container.classList.contains('arts-header_scrolling-down')).toBe(false)
    expect(displacedEvents).toEqual([true, false])
  })

  it('freezes direction handling while locked, and unsticking resets the direction classes', () => {
    const { container, sticky, deliverStick, scrollTo } = makeSticky()
    deliverStick(false, -5)
    sticky.setLocked(true)
    scrollTo(120)
    expect(container.classList.contains('arts-header_scrolling-down')).toBe(false)
    sticky.setLocked(false)
    scrollTo(240)
    expect(container.classList.contains('arts-header_scrolling-down')).toBe(true)
    deliverStick(true, 5)
    expect(container.classList.contains('arts-header_sticky')).toBe(false)
    expect(container.classList.contains('arts-header_scrolling-down')).toBe(false)
  })

  it('swaps configured toggle attributes between the class write and the event', () => {
    const seenAtEvent: (string | null)[] = []
    const fn = (): void => {
      seenAtEvent.push(document.querySelector('.js-arts-header')?.getAttribute('data-x') ?? null)
    }
    document.addEventListener('arts/header/sticky', fn)
    listeners.push({ name: 'arts/header/sticky', fn })
    const { deliverStick } = makeSticky({
      toggleAttributes: { 'data-x': { active: 'on', inactive: 'off' } }
    })
    deliverStick(false, -5)
    expect(seenAtEvent).toEqual(['on'])
    deliverStick(true, 5)
    expect(seenAtEvent).toEqual(['on', 'off'])
  })
})

describe('createSticky — scrub deferred publishing', () => {
  it('defers through a natural departure and publishes once a full bar height scrubbed away', () => {
    const stickyEvents = captureEvents('arts/header/sticky')
    const { container, sticky, deliverStick, scrollTo } = makeSticky({
      reveal: { mode: 'scrub', offset: 0 }
    })
    deliverStick(false, 0)
    expect(sticky.isSticking).toBe(false)
    expect(stickyEvents).toEqual([])
    // 4px ticks track the departure exactly (accumulator == scroll-since-stick), so nothing reads
    // as "held" until the bar fully leaves at 80px.
    let y = 0
    for (let i = 0; i < 10; i++) {
      y += 4
      scrollTo(y)
    }
    expect(sticky.isSticking).toBe(false)
    expect(container.style.transform).toBe('translateY(-40px)')
    for (let i = 0; i < 10; i++) {
      y += 4
      scrollTo(y)
    }
    expect(sticky.isSticking).toBe(true)
    expect(stickyEvents).toEqual([true])
    expect(container.style.transform).toBe('translateY(-80px)')
    expect(sticky.isDisplaced).toBe(true)
  })

  it('publishes early when the reveal offset holds the bar visibly pinned', () => {
    const { container, sticky, deliverStick, scrollTo } = makeSticky({
      reveal: { mode: 'scrub', offset: 200 }
    })
    deliverStick(false, 0)
    scrollTo(4)
    scrollTo(8)
    // The accumulator is offset-gated at 0 while the page scrolled 8px — visibly held → published.
    expect(sticky.isSticking).toBe(true)
    expect(container.style.transform).toBe('')
  })

  it('publishes immediately on a crossing deeper than a bar height (scroll-restored load)', () => {
    const { sticky, deliverStick } = makeSticky({ reveal: { mode: 'scrub', offset: 0 } })
    deliverStick(false, -200)
    expect(sticky.isSticking).toBe(true)
  })

  it('clears deferral leftovers when unsticking before the publish ever happened', () => {
    const { container, sticky, deliverStick, scrollTo } = makeSticky({
      reveal: { mode: 'scrub', offset: 0 }
    })
    deliverStick(false, 0)
    scrollTo(4)
    scrollTo(8)
    deliverStick(true, 5)
    expect(sticky.isSticking).toBe(false)
    expect(container.style.transform).toBe('translateY(-0px)')
    expect(container.classList.contains('arts-header_scrolling-down')).toBe(false)
  })
})

describe('createSticky — scrub ownership handoff', () => {
  const scrubTo40 = () => {
    const rig = makeSticky({ reveal: { mode: 'scrub', offset: 0 } })
    rig.deliverStick(false, 0)
    let y = 0
    for (let i = 0; i < 10; i++) {
      y += 4
      rig.scrollTo(y)
    }
    return rig
  }

  it('hands the transform to CSS while hidden, and reclaims parked-at-hidden on clear', () => {
    const { container, sticky } = scrubTo40()
    expect(container.classList.contains('arts-header_reveal-scrub')).toBe(true)
    sticky.setHidden(true)
    expect(container.classList.contains('arts-header_reveal-scrub')).toBe(false)
    expect(container.style.transform).toBe('')
    expect(container.classList.contains('arts-header_hidden')).toBe(true)
    sticky.setHidden(false)
    // Hidden parked the accumulator at full-hide; the reclaim restores exactly what CSS showed.
    expect(container.classList.contains('arts-header_reveal-scrub')).toBe(true)
    expect(container.style.transform).toBe('translateY(-80px)')
  })

  it('parks at shown when a lock reveals the bar, and reclaims from there on unlock', () => {
    const { container, sticky } = scrubTo40()
    sticky.setLocked(true)
    expect(container.style.transform).toBe('')
    expect(container.classList.contains('arts-header_reveal-scrub')).toBe(false)
    sticky.setLocked(false)
    expect(container.style.transform).toBe('translateY(-0px)')
    expect(container.classList.contains('arts-header_reveal-scrub')).toBe(true)
  })
})

describe('createSticky — destroy', () => {
  it('keeps the visual state on destroy(revert=false) while forgetting the values', () => {
    const stickyEvents = captureEvents('arts/header/sticky')
    const { container, sticky, deliverStick } = makeSticky()
    deliverStick(false, -5)
    sticky.destroy(false)
    expect(container.classList.contains('arts-header_sticky')).toBe(true)
    expect(sticky.isSticking).toBe(false)
    expect(stickyEvents).toEqual([true])
  })

  it('restores the DOM and fires the state events on destroy(revert=true)', () => {
    const stickyEvents = captureEvents('arts/header/sticky')
    const hiddenEvents = captureEvents('arts/header/hidden')
    const { container, sticky, deliverStick } = makeSticky()
    deliverStick(false, -5)
    sticky.setHidden(true)
    sticky.destroy(true)
    expect(container.classList.contains('arts-header_sticky')).toBe(false)
    expect(container.classList.contains('arts-header_hidden')).toBe(false)
    expect(stickyEvents).toEqual([true, false])
    expect(hiddenEvents).toEqual([true, false])
  })

  it('never leaves the scrub class or a stale transform behind when destroyed while locked', () => {
    const { container, sticky, deliverStick, scrollTo } = makeSticky({
      reveal: { mode: 'scrub', offset: 0 }
    })
    deliverStick(false, 0)
    scrollTo(4)
    sticky.setLocked(true)
    sticky.destroy(true)
    expect(container.classList.contains('arts-header_reveal-scrub')).toBe(false)
    expect(container.style.transform).toBe('')
    expect(container.classList.contains('arts-header_locked')).toBe(false)
  })

  it('is idempotent', () => {
    const { sticky } = makeSticky()
    sticky.destroy(true)
    expect(() => sticky.destroy(true)).not.toThrow()
  })
})
