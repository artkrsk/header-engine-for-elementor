// @vitest-environment happy-dom
import { SENTINEL_CLASS } from '@ts/constants'
import { createHeader } from '@ts/core/createHeader'
import type { IHeader } from '@ts/interfaces'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fakeIntersectionObserver,
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
  const io = fakeIntersectionObserver()
  fakeMutationObserver()
  fakeResizeObserver()
  fakeRaf()
  const { container, bar } = makeHeaderFixture(80)
  const header = createHeader(container, bar, ...args)
  created.push(header)
  const deliverStick = (isIntersecting: boolean, top: number): void => {
    io[0]?.callback(
      [{ isIntersecting, boundingClientRect: { top } } as IntersectionObserverEntry],
      {} as IntersectionObserver
    )
  }
  return { container, bar, header, deliverStick }
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
    fakeIntersectionObserver()
    fakeMutationObserver()
    fakeResizeObserver()
    const { container, bar } = makeHeaderFixture()
    container.setAttribute('data-arts-header-options', '{"sticky": false}')
    const header = createHeader(container, bar, { options: { sticky: {} } })
    created.push(header)
    header.init()
    // Constructor asked for sticky; inline said no — no sentinel means no stick detection wired.
    expect(document.querySelector(`.${SENTINEL_CLASS}`)).toBeNull()
    expect(header.isSticking).toBe(false)
  })

  it('init is idempotent — a second call wires nothing twice', () => {
    const { header } = makeRig()
    header.init()
    header.init()
    expect(document.querySelectorAll(`.${SENTINEL_CLASS}`)).toHaveLength(1)
  })

  it('delegates the public API to the sticky engine and publishes through it', () => {
    const { container, header, deliverStick } = makeRig()
    header.init()
    deliverStick(false, -5)
    expect(header.isSticking).toBe(true)
    header.toggleHidden(true)
    expect(header.isHidden).toBe(true)
    expect(container.classList.contains('arts-header_hidden')).toBe(true)
    header.lockSticky(true)
    expect(header.isLocked).toBe(true)
  })

  it('fails safe on every API call when sticky is disabled', () => {
    fakeIntersectionObserver()
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
    const { bar, header, deliverStick } = makeRig()
    header.init()
    vi.advanceTimersByTime(150)
    expect(document.documentElement.style.getPropertyValue('--arts-header-height')).toBe('80px')
    deliverStick(false, -5)
    bar.getBoundingClientRect = () => ({ height: 64 }) as DOMRect
    deliverStick(true, 5)
    // Unstick → handleStickyChange(false) → re-measure (zero transition duration in happy-dom).
    expect(document.documentElement.style.getPropertyValue('--arts-header-height')).toBe('64px')
    // Destroy while the rAF stubs are still installed; the afterEach re-destroy no-ops.
    header.destroy(false)
    vi.useRealTimers()
  })

  it('destroy(revert=false) keeps the visual state; destroy(revert=true) restores and re-inits cleanly', () => {
    const first = makeRig()
    first.header.init()
    first.deliverStick(false, -5)
    first.header.destroy(false)
    expect(first.container.classList.contains('arts-header_sticky')).toBe(true)
    expect(first.header.isInitialized).toBe(false)

    const second = makeRig()
    second.header.init()
    second.deliverStick(false, -5)
    second.header.destroy(true)
    expect(second.container.classList.contains('arts-header_sticky')).toBe(false)
    // A destroyed header re-inits from scratch.
    second.header.init()
    expect(second.header.isInitialized).toBe(true)
  })
})
