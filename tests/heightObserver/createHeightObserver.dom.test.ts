// @vitest-environment happy-dom
import { createHeightObserver } from '@ts/heightObserver/createHeightObserver'
import type { IHeightObserverArgs } from '@ts/interfaces'
import { resolveConfig } from '@ts/options/config'
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

  it('re-measures on the unstick transition after the bar transition, and ignores the stick one', () => {
    const { bar, observer, setBarHeight } = makeRig()
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      transitionDuration: '0.3s'
    } as CSSStyleDeclaration)
    setBarHeight(96)
    observer.handleStickyChange(true)
    vi.advanceTimersByTime(1000)
    expect(root().style.getPropertyValue(HEIGHT_VAR)).toBe('80px')
    observer.handleStickyChange(false)
    vi.advanceTimersByTime(299)
    expect(root().style.getPropertyValue(HEIGHT_VAR)).toBe('80px')
    vi.advanceTimersByTime(1)
    expect(root().style.getPropertyValue(HEIGHT_VAR)).toBe('96px')
    expect(bar).toBeDefined()
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
