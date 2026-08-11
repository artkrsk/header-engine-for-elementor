// @vitest-environment happy-dom
import { createZoneTracker } from '@ts/sticky/zones'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeIntersectionObserver, fakeMutationObserver, fakeRaf } from '../support'

afterEach(() => {
  document.body.innerHTML = ''
})

const addZone = (attr: string, mode: string): HTMLElement => {
  const el = document.createElement('section')
  el.setAttribute(attr, mode)
  document.body.appendChild(el)
  return el
}

const makeTracker = (onChange: (anyHide: boolean, anyLock: boolean) => void = () => {}) =>
  createZoneTracker({ getStickyTop: () => 32, getBarHeight: () => 80, onChange })

describe('createZoneTracker', () => {
  it('scans both zone kinds at construction and observes each with its mode geometry', () => {
    const io = fakeIntersectionObserver()
    fakeMutationObserver()
    const hide = addZone('data-arts-header-hide-over', 'at-top')
    const lock = addZone('data-arts-header-lock-over', 'in-view')
    makeTracker()
    expect(io).toHaveLength(2)
    expect(io[0]?.observed[0]?.target).toBe(hide)
    expect(io[0]?.init).toEqual({ rootMargin: '0px 0px -100% 0px', threshold: [0] })
    expect(io[1]?.observed[0]?.target).toBe(lock)
    expect(io[1]?.init).toEqual({ rootMargin: '0px', threshold: [0] })
  })

  it('combines active zones per kind, independently, on every delivery', () => {
    const io = fakeIntersectionObserver()
    fakeMutationObserver()
    addZone('data-arts-header-hide-over', 'at-top')
    addZone('data-arts-header-lock-over', 'at-top')
    const spy = vi.fn()
    makeTracker(spy)
    const observer = {} as IntersectionObserver
    io[0]?.callback([{ isIntersecting: true } as IntersectionObserverEntry], observer)
    expect(spy).toHaveBeenLastCalledWith(true, false)
    io[1]?.callback([{ isIntersecting: true } as IntersectionObserverEntry], observer)
    expect(spy).toHaveBeenLastCalledWith(true, true)
    io[0]?.callback([{ isIntersecting: false } as IntersectionObserverEntry], observer)
    expect(spy).toHaveBeenLastCalledWith(false, true)
  })

  it('coalesces an attribute-mutation burst into ONE rescan on the next frame', () => {
    const io = fakeIntersectionObserver()
    const mo = fakeMutationObserver()
    const raf = fakeRaf()
    addZone('data-arts-header-hide-over', 'at-top')
    makeTracker()
    const observed = io.length
    const observer = {} as MutationObserver
    mo[0]?.callback([], observer)
    mo[0]?.callback([], observer)
    mo[0]?.callback([], observer)
    expect(raf.pendingCount).toBe(1)
    raf.step()
    // One rescan: the prior zone observer disconnected once, one fresh observer created.
    expect(io[0]?.disconnectCount).toBe(1)
    expect(io.length).toBe(observed + 1)
  })

  it('refresh disconnects every existing zone observer before re-scanning — no leaks', () => {
    const io = fakeIntersectionObserver()
    fakeMutationObserver()
    addZone('data-arts-header-hide-over', 'at-top')
    addZone('data-arts-header-lock-over', 'overlap')
    const tracker = makeTracker()
    tracker.refresh()
    expect(io[0]?.disconnectCount).toBe(1)
    expect(io[1]?.disconnectCount).toBe(1)
    expect(io).toHaveLength(4)
  })

  it('destroy disconnects all zone observers and the MutationObserver itself', () => {
    const io = fakeIntersectionObserver()
    const mo = fakeMutationObserver()
    addZone('data-arts-header-hide-over', 'at-top')
    const tracker = makeTracker()
    tracker.destroy()
    expect(io[0]?.disconnectCount).toBe(1)
    expect(mo[0]?.disconnectCount).toBe(1)
  })
})
