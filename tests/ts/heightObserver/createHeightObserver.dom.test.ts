// @vitest-environment happy-dom
import { createHeightObserver } from '@ts/heightObserver/createHeightObserver'
import type { IHeightObserverArgs } from '@ts/interfaces'
import { resolveConfig } from '@ts/options/resolveConfig'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeResizeObserver } from '../support'

const HEIGHT_VAR = '--arts-header-height'
const NON_STICKY_VAR = '--arts-header-height-non-sticky'

const root = () => document.documentElement

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  root().style.removeProperty(HEIGHT_VAR)
  root().style.removeProperty(NON_STICKY_VAR)
  root().classList.remove('has-header-height')
  document.body.innerHTML = ''
})

const makeRig = (over: Partial<IHeightObserverArgs> = {}) => {
  const instances = fakeResizeObserver()
  const bar = document.createElement('div')
  let rectHeight = 80
  bar.getBoundingClientRect = () => ({ height: rectHeight }) as DOMRect
  document.body.appendChild(bar)
  const observer = createHeightObserver({
    bar,
    options: { observe: true, cleanupOnDestroy: false },
    config: resolveConfig(),
    isSticking: () => false,
    ...over
  })
  const setBarHeight = (height: number): void => {
    rectHeight = height
  }
  const fireResize = (): void => {
    instances[0]?.callback([], {} as ResizeObserver)
  }
  return { bar, observer, instances, setBarHeight, fireResize }
}

describe('createHeightObserver', () => {
  it('publishes the live height, the settled rest height, and the html class', () => {
    makeRig()
    expect(root().style.getPropertyValue(HEIGHT_VAR)).toBe('80px')
    expect(root().classList.contains('has-header-height')).toBe(true)
    expect(root().style.getPropertyValue(NON_STICKY_VAR)).toBe('')
    vi.advanceTimersByTime(150)
    expect(root().style.getPropertyValue(NON_STICKY_VAR)).toBe('80px')
  })

  it('keeps the pre-paint seed when booting already sticky with a shrunken bar', () => {
    root().style.setProperty(NON_STICKY_VAR, '110px')
    const { fireResize } = makeRig({ isSticking: () => true })
    fireResize()
    vi.advanceTimersByTime(150)
    // The settled capture skipped (sticky the whole time) — the seed was never stomped.
    expect(root().style.getPropertyValue(NON_STICKY_VAR)).toBe('110px')
  })

  it('never writes a 0 rest height over a good value', () => {
    const { setBarHeight, fireResize } = makeRig()
    vi.advanceTimersByTime(150)
    expect(root().style.getPropertyValue(NON_STICKY_VAR)).toBe('80px')
    setBarHeight(0)
    fireResize()
    vi.advanceTimersByTime(150)
    expect(root().style.getPropertyValue(HEIGHT_VAR)).toBe('0px')
    expect(root().style.getPropertyValue(NON_STICKY_VAR)).toBe('80px')
  })

  it('prefers the RO entry size over a rect re-read on the observer path', () => {
    const { instances } = makeRig()
    // The rect stub still reports 80 — only the entry carries the new border-box size.
    const entry = {
      borderBoxSize: [{ blockSize: 64, inlineSize: 300 }]
    } as unknown as ResizeObserverEntry
    instances[0]?.callback([entry], {} as ResizeObserver)
    expect(root().style.getPropertyValue(HEIGHT_VAR)).toBe('64px')
  })

  it('publishes a caller-measured initialHeight and update(height) without reading the bar rect', () => {
    fakeResizeObserver()
    const bar = document.createElement('div')
    const rect = vi.fn(() => ({ height: 80 }) as DOMRect)
    bar.getBoundingClientRect = rect
    document.body.appendChild(bar)
    const observer = createHeightObserver({
      bar,
      options: { observe: true, cleanupOnDestroy: false },
      config: resolveConfig(),
      isSticking: () => false,
      initialHeight: 64
    })
    expect(root().style.getPropertyValue(HEIGHT_VAR)).toBe('64px')
    expect(rect).not.toHaveBeenCalled()
    observer.update(72)
    expect(root().style.getPropertyValue(HEIGHT_VAR)).toBe('72px')
    expect(rect).not.toHaveBeenCalled()
    // The settled rest capture still measures on its own clock.
    vi.advanceTimersByTime(150)
    expect(rect).toHaveBeenCalledTimes(1)
    expect(root().style.getPropertyValue(NON_STICKY_VAR)).toBe('80px')
  })

  it('captures the rest height once settled, ignoring mid-transition frames', () => {
    const { setBarHeight, fireResize } = makeRig()
    vi.advanceTimersByTime(150)
    setBarHeight(64)
    fireResize()
    vi.advanceTimersByTime(100)
    setBarHeight(72)
    fireResize()
    vi.advanceTimersByTime(100)
    // Still inside the debounce window after the second frame — old value holds.
    expect(root().style.getPropertyValue(NON_STICKY_VAR)).toBe('80px')
    vi.advanceTimersByTime(50)
    expect(root().style.getPropertyValue(NON_STICKY_VAR)).toBe('72px')
  })

  it('signals settled var changes once — a stale pre-paint seed corrects and consumers re-resolve', () => {
    const onHeightVarsSettled = vi.fn()
    // Pre-paint seed measured against unstyled markup (e.g. an overlay not yet position:fixed).
    root().style.setProperty(NON_STICKY_VAR, '1400px')
    const { fireResize } = makeRig({ onHeightVarsSettled })
    vi.advanceTimersByTime(300)
    // The settled capture (80px) replaced the stale seed — one signal for the whole boot.
    expect(root().style.getPropertyValue(NON_STICKY_VAR)).toBe('80px')
    expect(onHeightVarsSettled).toHaveBeenCalledTimes(1)
    fireResize()
    vi.advanceTimersByTime(300)
    // Unchanged heights — no repeat signal.
    expect(onHeightVarsSettled).toHaveBeenCalledTimes(1)
  })

  it('signals a live-height settle while sticky — a chained pin offset must re-resolve', () => {
    const onHeightVarsSettled = vi.fn()
    const { setBarHeight, fireResize } = makeRig({
      isSticking: () => true,
      onHeightVarsSettled
    })
    vi.advanceTimersByTime(300)
    onHeightVarsSettled.mockClear()
    // Sticky styling shrinks the bar: the rest capture is gated off, the live var still settles.
    setBarHeight(64)
    fireResize()
    vi.advanceTimersByTime(300)
    expect(root().style.getPropertyValue(HEIGHT_VAR)).toBe('64px')
    expect(onHeightVarsSettled).toHaveBeenCalledTimes(1)
  })

  it('destroy cancels the pending settled capture — nothing rewrites the reverted vars', () => {
    const { setBarHeight, fireResize, observer } = makeRig({
      options: { observe: true, cleanupOnDestroy: true }
    })
    vi.advanceTimersByTime(300)
    setBarHeight(64)
    fireResize()
    observer.destroy(true)
    vi.advanceTimersByTime(300)
    expect(root().style.getPropertyValue(HEIGHT_VAR)).toBe('')
    expect(root().style.getPropertyValue(NON_STICKY_VAR)).toBe('')
  })

  it('destroy neutralizes the pending unstick re-measure timer', () => {
    const { setBarHeight, observer } = makeRig({
      options: { observe: true, cleanupOnDestroy: true }
    })
    vi.advanceTimersByTime(300)
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      transitionDuration: '0.3s'
    } as CSSStyleDeclaration)
    setBarHeight(96)
    observer.handleStickyChange(false)
    observer.destroy(true)
    vi.advanceTimersByTime(1000)
    expect(root().style.getPropertyValue(HEIGHT_VAR)).toBe('')
  })

  // Endpoint publishing: a state flip suppresses RO-driven live writes for the bar's own
  // transition and publishes ONCE, settled — per-frame root var writes style-recalc every
  // consumer of the inherited property (the profiled sticky-shrink jank).
  it('suppresses live writes through the stick transition and publishes the settled height once', () => {
    const { observer, setBarHeight, fireResize } = makeRig()
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      transitionDuration: '0.3s'
    } as CSSStyleDeclaration)
    observer.handleStickyChange(true)
    // Mid-transition RO frames must not reach the root var.
    setBarHeight(72)
    fireResize()
    vi.advanceTimersByTime(150)
    setBarHeight(66)
    fireResize()
    vi.advanceTimersByTime(149)
    expect(root().style.getPropertyValue(HEIGHT_VAR)).toBe('80px')
    vi.advanceTimersByTime(1)
    expect(root().style.getPropertyValue(HEIGHT_VAR)).toBe('66px')
  })

  it('re-measures on the unstick transition after the bar transition, suppressing mid-flight frames', () => {
    const { observer, setBarHeight, fireResize } = makeRig()
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      transitionDuration: '0.3s'
    } as CSSStyleDeclaration)
    setBarHeight(96)
    observer.handleStickyChange(false)
    fireResize()
    vi.advanceTimersByTime(299)
    expect(root().style.getPropertyValue(HEIGHT_VAR)).toBe('80px')
    vi.advanceTimersByTime(1)
    expect(root().style.getPropertyValue(HEIGHT_VAR)).toBe('96px')
  })

  it('resumes live RO writes once the transition window closed', () => {
    const { observer, setBarHeight, fireResize } = makeRig()
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      transitionDuration: '0.3s'
    } as CSSStyleDeclaration)
    observer.handleStickyChange(true)
    vi.advanceTimersByTime(300)
    setBarHeight(120)
    fireResize()
    expect(root().style.getPropertyValue(HEIGHT_VAR)).toBe('120px')
  })

  it('rounds RO entry heights to whole pixels', () => {
    const { instances } = makeRig()
    const entry = {
      borderBoxSize: [{ blockSize: 64.4, inlineSize: 300 }]
    } as unknown as ResizeObserverEntry
    instances[0]?.callback([entry], {} as ResizeObserver)
    expect(root().style.getPropertyValue(HEIGHT_VAR)).toBe('64px')
  })

  it('cleans the published surface only on destroy(revert) with cleanupOnDestroy', () => {
    const keep = makeRig()
    keep.observer.destroy(true)
    expect(root().style.getPropertyValue(HEIGHT_VAR)).toBe('80px')
    expect(root().classList.contains('has-header-height')).toBe(true)

    const clean = makeRig({ options: { observe: true, cleanupOnDestroy: true } })
    clean.observer.destroy(true)
    expect(root().style.getPropertyValue(HEIGHT_VAR)).toBe('')
    expect(root().classList.contains('has-header-height')).toBe(false)
  })

  it('skips writes for empty-string opt-outs and skips the RO when observe is false', () => {
    const instances = fakeResizeObserver()
    const bar = document.createElement('div')
    bar.getBoundingClientRect = () => ({ height: 80 }) as DOMRect
    document.body.appendChild(bar)
    const config = resolveConfig({
      vars: { headerHeight: '' },
      classes: { hasHeaderHeight: '' }
    })
    createHeightObserver({
      bar,
      options: { observe: false, cleanupOnDestroy: false },
      config,
      isSticking: () => false
    })
    expect(root().style.getPropertyValue(HEIGHT_VAR)).toBe('')
    expect(root().classList.contains('has-header-height')).toBe(false)
    expect(instances).toHaveLength(0)
  })

  it('destroy disconnects the resize observer and tolerates a second call', () => {
    const { observer, instances } = makeRig()
    observer.destroy(false)
    observer.destroy(false)
    expect(instances[0]?.disconnectCount).toBe(1)
  })
})
