// @vitest-environment happy-dom
import { createHeightObserver } from '@ts/heightObserver/createHeightObserver'
import type { IHeightObserverArgs } from '@ts/interfaces'
import { resolveConfig } from '@ts/options/resolveConfig'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeRaf, fakeResizeObserver } from '../support'

const STICKY_VAR = '--arts-header-height-sticky'
const NON_STICKY_VAR = '--arts-header-height-non-sticky'
const CLEARANCE_VAR = '--arts-header-clearance-non-sticky'
/** The engine's former live var — nothing may write it any more. */
const LIVE_VAR = '--arts-header-height'

const root = () => document.documentElement
const sticky = () => root().style.getPropertyValue(STICKY_VAR)
const rest = () => root().style.getPropertyValue(NON_STICKY_VAR)

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  root().style.removeProperty(STICKY_VAR)
  root().style.removeProperty(NON_STICKY_VAR)
  root().style.removeProperty(CLEARANCE_VAR)
  root().style.removeProperty(LIVE_VAR)
  root().classList.remove('has-header-height')
  document.body.innerHTML = ''
})

const makeRig = (over: Partial<IHeightObserverArgs> = {}, stickingAtBoot = false) => {
  const instances = fakeResizeObserver()
  const raf = fakeRaf()
  const bar = document.createElement('div')
  let rectHeight = 80
  let sticking = stickingAtBoot
  bar.getBoundingClientRect = () => ({ top: 0, bottom: rectHeight, height: rectHeight }) as DOMRect
  document.body.appendChild(bar)
  const observer = createHeightObserver({
    bar,
    options: { observe: true, cleanupOnDestroy: false },
    config: resolveConfig(),
    isSticking: () => sticking,
    ...over
  })
  const setBarHeight = (height: number): void => {
    rectHeight = height
  }
  const setSticking = (value: boolean): void => {
    sticking = value
  }
  /** Deliver the RO, then run the frame the RO-driven capture is deferred to. */
  const fireResize = (): void => {
    instances[0]?.callback([], {} as ResizeObserver)
    raf.step()
  }
  return { bar, observer, instances, raf, setBarHeight, setSticking, fireResize }
}

const mockTransition = (seconds: string): void => {
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({
    transitionDuration: seconds
  } as CSSStyleDeclaration)
}

describe('createHeightObserver', () => {
  it('publishes the settled rest height and the html class, and never a live height', () => {
    makeRig()
    expect(root().classList.contains('has-header-height')).toBe(true)
    expect(rest()).toBe('')
    vi.advanceTimersByTime(150)
    expect(rest()).toBe('80px')
    expect(sticky()).toBe('')
    expect(root().style.getPropertyValue(LIVE_VAR)).toBe('')
  })

  it('keeps the pre-paint seed when booting already sticky with a shrunken bar', () => {
    root().style.setProperty(NON_STICKY_VAR, '110px')
    const { fireResize } = makeRig({}, true)
    fireResize()
    vi.advanceTimersByTime(150)
    // The rest capture skipped (sticky the whole time) — the seed was never stomped; the stuck
    // bar's settled height is the sticky value.
    expect(rest()).toBe('110px')
    expect(sticky()).toBe('80px')
  })

  it('never writes a 0 rest height over a good value', () => {
    const { setBarHeight, fireResize } = makeRig()
    vi.advanceTimersByTime(150)
    expect(rest()).toBe('80px')
    setBarHeight(0)
    fireResize()
    vi.advanceTimersByTime(150)
    expect(rest()).toBe('80px')
  })

  // A root var write inside the delivery can resize <html> (a consumer turning the var into page
  // height), which other ROs observe — the browser then reports the RO loop error.
  it('arms RO-driven captures on the next frame, never inside the observer callback', () => {
    const { instances, raf, setBarHeight } = makeRig({}, true)
    vi.advanceTimersByTime(150)
    expect(sticky()).toBe('80px')
    setBarHeight(64)
    instances[0]?.callback([], {} as ResizeObserver)
    vi.advanceTimersByTime(150)
    expect(sticky()).toBe('80px')
    raf.step()
    vi.advanceTimersByTime(150)
    expect(sticky()).toBe('64px')
  })

  it('a frame still queued at destroy writes nothing', () => {
    const { instances, raf, observer } = makeRig(
      { options: { observe: true, cleanupOnDestroy: true } },
      true
    )
    instances[0]?.callback([], {} as ResizeObserver)
    observer.destroy(true)
    raf.step()
    vi.advanceTimersByTime(150)
    expect(sticky()).toBe('')
  })

  it('publishes a caller-measured height at once while stuck, without reading the bar rect', () => {
    fakeResizeObserver()
    const bar = document.createElement('div')
    const rect = vi.fn(() => ({ top: 0, bottom: 80, height: 80 }) as DOMRect)
    bar.getBoundingClientRect = rect
    document.body.appendChild(bar)
    const observer = createHeightObserver({
      bar,
      options: { observe: true, cleanupOnDestroy: false },
      config: resolveConfig(),
      isSticking: () => true,
      initialHeight: 64
    })
    expect(sticky()).toBe('64px')
    expect(rect).not.toHaveBeenCalled()
    observer.update(72)
    expect(sticky()).toBe('72px')
    expect(rect).not.toHaveBeenCalled()
    // The settled capture still measures on its own clock.
    vi.advanceTimersByTime(150)
    expect(rect).toHaveBeenCalledTimes(1)
    expect(sticky()).toBe('80px')
  })

  it('leaves a caller-measured height to the settle while not stuck — the rest pair needs the clearance read', () => {
    const { observer } = makeRig()
    observer.update(72)
    expect(rest()).toBe('')
    vi.advanceTimersByTime(150)
    expect(rest()).toBe('80px')
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
    expect(rest()).toBe('80px')
    vi.advanceTimersByTime(50)
    expect(rest()).toBe('72px')
  })

  it('signals settled var changes once — a stale pre-paint seed corrects and consumers re-resolve', () => {
    const onHeightVarsSettled = vi.fn()
    // Pre-paint seed measured against unstyled markup (e.g. an overlay not yet position:fixed).
    root().style.setProperty(NON_STICKY_VAR, '1400px')
    const { fireResize } = makeRig({ onHeightVarsSettled })
    vi.advanceTimersByTime(300)
    // The settled capture (80px) replaced the stale seed — one signal for the whole boot.
    expect(rest()).toBe('80px')
    expect(onHeightVarsSettled).toHaveBeenCalledTimes(1)
    fireResize()
    vi.advanceTimersByTime(300)
    // Unchanged heights — no repeat signal.
    expect(onHeightVarsSettled).toHaveBeenCalledTimes(1)
  })

  it('signals a sticky-height settle while stuck — a chained pin offset must re-resolve', () => {
    const onHeightVarsSettled = vi.fn()
    const { setBarHeight, fireResize } = makeRig({ onHeightVarsSettled }, true)
    vi.advanceTimersByTime(300)
    onHeightVarsSettled.mockClear()
    // Sticky styling shrinks the bar: the rest capture is gated off, the sticky var settles.
    setBarHeight(64)
    fireResize()
    vi.advanceTimersByTime(300)
    expect(sticky()).toBe('64px')
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
    expect(rest()).toBe('')
    expect(sticky()).toBe('')
  })

  it('destroy neutralizes the pending unstick re-measure timer', () => {
    const { setBarHeight, setSticking, observer } = makeRig(
      { options: { observe: true, cleanupOnDestroy: true } },
      true
    )
    vi.advanceTimersByTime(300)
    mockTransition('0.3s')
    setBarHeight(96)
    setSticking(false)
    observer.handleStickyChange(false)
    observer.destroy(true)
    vi.advanceTimersByTime(1000)
    expect(rest()).toBe('')
    expect(sticky()).toBe('')
  })

  // Endpoint publishing: a state flip suppresses RO-driven captures for the bar's own transition
  // and publishes ONCE, settled — per-frame root var writes style-recalc every consumer of the
  // inherited property (the profiled sticky-shrink jank).
  it('publishes the sticky height once the stick transition and the settle have passed', () => {
    const { observer, setBarHeight, setSticking, fireResize } = makeRig()
    vi.advanceTimersByTime(150)
    mockTransition('0.3s')
    setSticking(true)
    observer.handleStickyChange(true)
    // Mid-transition RO frames must not reach the root.
    setBarHeight(72)
    fireResize()
    vi.advanceTimersByTime(150)
    setBarHeight(66)
    fireResize()
    vi.advanceTimersByTime(149)
    expect(sticky()).toBe('')
    // Transition over at 300 ms, the settle fires 150 ms later.
    vi.advanceTimersByTime(150)
    expect(sticky()).toBe('')
    vi.advanceTimersByTime(1)
    expect(sticky()).toBe('66px')
    expect(rest()).toBe('80px')
  })

  it('re-measures the rest height on the unstick transition, suppressing mid-flight frames', () => {
    const { observer, setBarHeight, setSticking, fireResize } = makeRig({}, true)
    vi.advanceTimersByTime(150)
    expect(sticky()).toBe('80px')
    mockTransition('0.3s')
    setBarHeight(96)
    setSticking(false)
    observer.handleStickyChange(false)
    fireResize()
    vi.advanceTimersByTime(449)
    expect(rest()).toBe('')
    vi.advanceTimersByTime(1)
    expect(rest()).toBe('96px')
    expect(sticky()).toBe('80px')
  })

  it('resumes RO-driven captures once the transition window closed', () => {
    const { observer, setBarHeight, setSticking, fireResize } = makeRig()
    mockTransition('0.3s')
    setSticking(true)
    observer.handleStickyChange(true)
    vi.advanceTimersByTime(450)
    expect(sticky()).toBe('80px')
    setBarHeight(120)
    fireResize()
    vi.advanceTimersByTime(150)
    expect(sticky()).toBe('120px')
  })

  it('rounds heights to whole pixels', () => {
    const { setBarHeight, fireResize } = makeRig({}, true)
    setBarHeight(64.4)
    fireResize()
    vi.advanceTimersByTime(150)
    expect(sticky()).toBe('64px')
  })

  it('cleans the published surface only on destroy(revert) with cleanupOnDestroy', () => {
    const keep = makeRig({}, true)
    vi.advanceTimersByTime(150)
    keep.observer.destroy(true)
    expect(sticky()).toBe('80px')
    expect(root().classList.contains('has-header-height')).toBe(true)

    const clean = makeRig({ options: { observe: true, cleanupOnDestroy: true } }, true)
    vi.advanceTimersByTime(150)
    clean.observer.destroy(true)
    expect(sticky()).toBe('')
    expect(root().classList.contains('has-header-height')).toBe(false)
  })

  it('skips writes for empty-string opt-outs and skips the RO when observe is false', () => {
    const instances = fakeResizeObserver()
    const bar = document.createElement('div')
    bar.getBoundingClientRect = () => ({ top: 0, bottom: 80, height: 80 }) as DOMRect
    document.body.appendChild(bar)
    const config = resolveConfig({
      vars: { headerHeightSticky: '' },
      classes: { hasHeaderHeight: '' }
    })
    createHeightObserver({
      bar,
      options: { observe: false, cleanupOnDestroy: false },
      config,
      isSticking: () => true,
      initialHeight: 64
    })
    vi.advanceTimersByTime(150)
    expect(sticky()).toBe('')
    expect(root().classList.contains('has-header-height')).toBe(false)
    expect(instances).toHaveLength(0)
  })

  it('destroy disconnects the resize observer and tolerates a second call', () => {
    const { observer, instances } = makeRig()
    observer.destroy(false)
    observer.destroy(false)
    expect(instances[0]?.disconnectCount).toBe(1)
  })

  // An inherited var on <html> re-resolves every var() user on the page: only settled endpoints
  // are written, and only when they changed.
  it('writes nothing on <html> while the bar transitions and one settled endpoint after', () => {
    const { observer, setBarHeight, setSticking, fireResize } = makeRig()
    vi.advanceTimersByTime(150)
    const rootWrites = vi.spyOn(root().style, 'setProperty')
    mockTransition('0.3s')
    setSticking(true)
    observer.handleStickyChange(true)
    for (const height of [76, 72, 68]) {
      setBarHeight(height)
      fireResize()
      vi.advanceTimersByTime(90)
    }
    expect(rootWrites).not.toHaveBeenCalled()
    vi.advanceTimersByTime(400)
    expect(rootWrites).toHaveBeenCalledTimes(1)
    expect(rootWrites).toHaveBeenCalledWith(STICKY_VAR, '68px')
  })

  it('skips every write whose value is already inline — a seeded boot and repeated updates cost nothing', () => {
    root().style.setProperty(NON_STICKY_VAR, '80px')
    root().style.setProperty(CLEARANCE_VAR, '80px')
    const rootWrites = vi.spyOn(root().style, 'setProperty')
    const { observer, setSticking } = makeRig({ initialHeight: 80 })
    vi.advanceTimersByTime(150)
    expect(rootWrites).not.toHaveBeenCalled()
    observer.update(80)
    vi.advanceTimersByTime(150)
    expect(rootWrites).not.toHaveBeenCalled()
    setSticking(true)
    observer.update(64)
    observer.update(64)
    expect(rootWrites).toHaveBeenCalledTimes(1)
    expect(rootWrites).toHaveBeenCalledWith(STICKY_VAR, '64px')
  })

  describe('rest clearance', () => {
    /** A marked descendant whose bottom edge is `bottom` px below the bar's top. */
    const mark = (bar: HTMLElement, bottom: number, visible = true): HTMLElement => {
      const el = document.createElement('li')
      el.setAttribute('data-arts-header-extent', '')
      el.getBoundingClientRect = () => ({ top: 0, bottom, height: bottom }) as DOMRect
      el.checkVisibility = () => visible
      bar.appendChild(el)
      return el
    }

    const rigWithExtent = (
      bottom: number,
      visible = true,
      over: Partial<IHeightObserverArgs> = {}
    ) => {
      const instances = fakeResizeObserver()
      const raf = fakeRaf()
      const bar = document.createElement('div')
      bar.getBoundingClientRect = () => ({ top: 0, bottom: 80, height: 80 }) as DOMRect
      document.body.appendChild(bar)
      const el = mark(bar, bottom, visible)
      const observer = createHeightObserver({
        bar,
        options: { observe: true, cleanupOnDestroy: true },
        config: resolveConfig(),
        isSticking: () => false,
        ...over
      })
      return { bar, el, observer, instances, raf }
    }

    it('publishes the lowest visible marked edge beside the rest height', () => {
      rigWithExtent(200)
      vi.advanceTimersByTime(150)
      expect(rest()).toBe('80px')
      expect(root().style.getPropertyValue(CLEARANCE_VAR)).toBe('200px')
    })

    it('equals the rest height when nothing marked sits below the bar', () => {
      makeRig()
      vi.advanceTimersByTime(150)
      expect(root().style.getPropertyValue(CLEARANCE_VAR)).toBe('80px')
    })

    it('skips a hidden marked element, so a collapsed list adds nothing', () => {
      rigWithExtent(200, false)
      vi.advanceTimersByTime(150)
      expect(root().style.getPropertyValue(CLEARANCE_VAR)).toBe('80px')
    })

    it('keeps the pre-paint seed while sticking and never writes it from a sticky capture', () => {
      root().style.setProperty(CLEARANCE_VAR, '230px')
      rigWithExtent(200, true, { isSticking: () => true })
      vi.advanceTimersByTime(150)
      expect(root().style.getPropertyValue(CLEARANCE_VAR)).toBe('230px')
    })

    it('observes the marked elements and re-captures when one resizes', () => {
      const { instances, raf, el } = rigWithExtent(200)
      vi.advanceTimersByTime(150)
      expect(root().style.getPropertyValue(CLEARANCE_VAR)).toBe('200px')
      el.getBoundingClientRect = () => ({ top: 0, bottom: 260, height: 260 }) as DOMRect
      instances[0]?.callback(
        [{ target: el } as unknown as ResizeObserverEntry],
        {} as ResizeObserver
      )
      raf.step()
      vi.advanceTimersByTime(150)
      expect(root().style.getPropertyValue(CLEARANCE_VAR)).toBe('260px')
    })

    it('removes the var on a reverting destroy and honours an empty-string opt-out', () => {
      const { observer } = rigWithExtent(200)
      vi.advanceTimersByTime(150)
      observer.destroy(true)
      expect(root().style.getPropertyValue(CLEARANCE_VAR)).toBe('')

      rigWithExtent(200, true, { config: resolveConfig({ vars: { clearanceNonSticky: '' } }) })
      vi.advanceTimersByTime(150)
      expect(root().style.getPropertyValue(CLEARANCE_VAR)).toBe('')
    })
  })
})
