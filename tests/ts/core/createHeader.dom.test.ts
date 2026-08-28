// @vitest-environment happy-dom
import { createHeader } from '@ts/core/createHeader'
import type { IHeader } from '@ts/interfaces'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fakeMutationObserver,
  fakeRaf,
  fakeResizeObserver,
  makeHeaderFixture,
  setScroll,
  setScrollBounds
} from '../support'

const created: IHeader[] = []

beforeEach(() => {
  setScrollBounds(5000, 800)
  setScroll(0, 0)
})

afterEach(() => {
  for (const header of created) {
    header.destroy(false)
  }
  created.length = 0
  document.documentElement.style.removeProperty('--arts-header-height')
  document.documentElement.style.removeProperty('--arts-header-height-non-sticky')
  document.documentElement.classList.remove('has-header-height')
  document.body.innerHTML = ''
})

const makeRig = (
  ...args: Parameters<typeof createHeader> extends [unknown, unknown, ...infer R] ? R : never
) => {
  fakeMutationObserver()
  const ro = fakeResizeObserver()
  const raf = fakeRaf()
  const { container, bar } = makeHeaderFixture(80)
  const header = createHeader(container, bar, ...args)
  created.push(header)
  // Natural position is 0 (stubbed rects) — any scroll pins, scrolling back unpins.
  const scrollTo = (y: number): void => {
    setScroll(0, y)
    window.dispatchEvent(new Event('scroll'))
    raf.step()
  }
  return { container, bar, header, scrollTo, ro }
}

describe('createHeader', () => {
  it('never throws on missing elements — logs and no-ops so a half-rendered page degrades', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const header = createHeader(null as unknown as HTMLElement, null as unknown as HTMLElement)
    expect(errorSpy).toHaveBeenCalledTimes(2)
    expect(() => header.init()).not.toThrow()
    expect(header.isInitialized).toBe(false)
  })

  it('lets inline data-arts-header-options REPLACE constructor options entirely', () => {
    fakeMutationObserver()
    fakeResizeObserver()
    const raf = fakeRaf()
    const { container, bar } = makeHeaderFixture()
    container.setAttribute('data-arts-header-options', '{"sticky": false}')
    const header = createHeader(container, bar, { options: { sticky: {} } })
    created.push(header)
    header.init()
    // Constructor asked for sticky; inline said no — scrolling never publishes a pin.
    setScroll(0, 300)
    window.dispatchEvent(new Event('scroll'))
    raf.step()
    expect(header.isSticking).toBe(false)
    expect(container.classList.contains('arts-header_sticky')).toBe(false)
  })

  it('init is idempotent — a second call wires nothing twice', () => {
    const stickyEvents: boolean[] = []
    const fn = (): void => {
      stickyEvents.push(true)
    }
    document.addEventListener('arts/header/sticky', fn)
    const { header, scrollTo } = makeRig()
    header.init()
    header.init()
    scrollTo(50)
    // Exactly one engine publishes — a double wire would fire the event twice per transition.
    expect(stickyEvents).toHaveLength(1)
    document.removeEventListener('arts/header/sticky', fn)
  })

  it('delegates the public API to the sticky engine and publishes through it', () => {
    const { container, header, scrollTo } = makeRig()
    header.init()
    scrollTo(50)
    expect(header.isSticking).toBe(true)
    header.toggleHidden(true)
    expect(header.isHidden).toBe(true)
    expect(container.classList.contains('arts-header_hidden')).toBe(true)
    header.lockSticky(true)
    expect(header.isLocked).toBe(true)
  })

  it('fails safe on every API call when sticky is disabled', () => {
    fakeMutationObserver()
    fakeResizeObserver()
    const { container, bar } = makeHeaderFixture()
    const header = createHeader(container, bar, { options: { sticky: false } })
    created.push(header)
    header.init()
    expect(() => {
      header.toggleHidden(true)
      header.lockSticky(true)
      header.refreshZones()
      header.refresh()
    }).not.toThrow()
    expect(header.isSticking).toBe(false)
    expect(header.isHidden).toBe(false)
    expect(header.isReleased).toBe(false)
    expect(header.isDisplaced).toBe(false)
  })

  it('re-measures the height through the sticky change wiring end to end', () => {
    vi.useFakeTimers()
    const { bar, header, scrollTo } = makeRig()
    header.init()
    vi.advanceTimersByTime(150)
    expect(document.documentElement.style.getPropertyValue('--arts-header-height')).toBe('80px')
    scrollTo(50)
    bar.getBoundingClientRect = () => ({ height: 64 }) as DOMRect
    scrollTo(0)
    // Unstick → handleStickyChange(false) → re-measure (zero transition duration in happy-dom).
    expect(document.documentElement.style.getPropertyValue('--arts-header-height')).toBe('64px')
    // Destroy while the rAF stubs are still installed; the afterEach re-destroy no-ops.
    header.destroy(false)
    vi.useRealTimers()
  })

  it('re-measures the sticky pass when the published height vars settle while stuck', () => {
    vi.useFakeTimers()
    const { container, bar, header, scrollTo, ro } = makeRig()
    header.init()
    vi.advanceTimersByTime(300)
    scrollTo(50)
    // A chained reveal offset re-resolves against the fresh height var...
    container.style.setProperty('--arts-header-reveal-offset', '500px')
    bar.getBoundingClientRect = () => ({ height: 64 }) as DOMRect
    // ...but only the height publisher's observer fires (the sticky's own bar RO would
    // re-measure anyway and mask the wiring under test).
    const heightObserverRecord = ro.filter((o) => o.observed.some((e) => e.target === bar))[1]
    expect(heightObserverRecord).toBeDefined()
    heightObserverRecord?.callback([], {} as ResizeObserver)
    vi.advanceTimersByTime(300)
    // Reveal (upward tick), then move down again inside the new 500px slack.
    scrollTo(40)
    scrollTo(300)
    // The settled-vars signal re-measured the 500px offset: no hide at 300.
    expect(container.classList.contains('arts-header_scrolling-down')).toBe(false)
    header.destroy(false)
    vi.useRealTimers()
  })

  it('destroy(revert=false) keeps the visual state; destroy(revert=true) restores and re-inits cleanly', () => {
    const first = makeRig()
    first.header.init()
    first.scrollTo(50)
    first.header.destroy(false)
    expect(first.container.classList.contains('arts-header_sticky')).toBe(true)
    expect(first.header.isInitialized).toBe(false)

    const second = makeRig()
    second.header.init()
    second.scrollTo(50)
    second.header.destroy(true)
    expect(second.container.classList.contains('arts-header_sticky')).toBe(false)
    // A destroyed header re-inits from scratch.
    second.header.init()
    expect(second.header.isInitialized).toBe(true)
  })
})
