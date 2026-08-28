// @vitest-environment happy-dom
import { createZoneTracker } from '@ts/sticky/zones'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeMutationObserver, fakeRaf } from '../support'

afterEach(() => {
  document.body.innerHTML = ''
})

const addZone = (attr: string, mode: string, top: number, bottom: number): HTMLElement => {
  const el = document.createElement('section')
  el.setAttribute(attr, mode)
  el.getBoundingClientRect = () => ({ top, bottom }) as DOMRect
  document.body.appendChild(el)
  return el
}

const makeTracker = (onChange = vi.fn()) => {
  const tracker = createZoneTracker({
    getPinLine: () => 0,
    getBarHeight: () => 80,
    getViewportH: () => 900,
    onChange
  })
  return { tracker, onChange }
}

describe('createZoneTracker', () => {
  it('caches doc-space rects at scan and drives both kinds from pure geometry on evaluate', () => {
    addZone('data-arts-header-hide-over', 'at-top', 1000, 2500)
    addZone('data-arts-header-lock-over', 'in-view', 4000, 4500)
    const { tracker, onChange } = makeTracker()
    tracker.evaluate(1200)
    expect(onChange).toHaveBeenLastCalledWith(true, false)
    tracker.evaluate(3200)
    expect(onChange).toHaveBeenLastCalledWith(false, true)
    tracker.evaluate(0)
    expect(onChange).toHaveBeenLastCalledWith(false, false)
  })

  it('dedups evaluations that do not change the combined state', () => {
    addZone('data-arts-header-hide-over', 'at-top', 1000, 2500)
    const { tracker, onChange } = makeTracker()
    tracker.evaluate(1200)
    tracker.evaluate(1300)
    tracker.evaluate(1400)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('coalesces an attribute-mutation burst into ONE rescan on the next frame', () => {
    const moInstances = fakeMutationObserver()
    const raf = fakeRaf()
    const zone = addZone('data-arts-header-hide-over', 'at-top', 1000, 2500)
    const { tracker, onChange } = makeTracker()
    tracker.evaluate(1200)
    expect(onChange).toHaveBeenLastCalledWith(true, false)
    // The zone attribute is removed; a burst of mutations schedules exactly one rAF rescan.
    zone.removeAttribute('data-arts-header-hide-over')
    const observer = {} as MutationObserver
    moInstances[0]?.callback([], observer)
    moInstances[0]?.callback([], observer)
    expect(raf.pendingCount).toBe(1)
    raf.step()
    expect(onChange).toHaveBeenLastCalledWith(false, false)
  })

  it('refresh re-scans and re-evaluates at the last known scroll position', () => {
    const { tracker, onChange } = makeTracker()
    tracker.evaluate(1200)
    expect(onChange).not.toHaveBeenCalled()
    addZone('data-arts-header-hide-over', 'at-top', 1000, 2500)
    tracker.refresh()
    expect(onChange).toHaveBeenLastCalledWith(true, false)
  })

  it('refresh(y) evaluates at the given position, not the stale tick one', () => {
    addZone('data-arts-header-hide-over', 'at-top', 1000, 2500)
    const { tracker, onChange } = makeTracker()
    tracker.evaluate(0)
    expect(onChange).not.toHaveBeenCalled()
    tracker.refresh(1200)
    expect(onChange).toHaveBeenLastCalledWith(true, false)
  })

  it('destroy disconnects the MutationObserver and cancels a pending rescan', () => {
    const moInstances = fakeMutationObserver()
    const raf = fakeRaf()
    addZone('data-arts-header-hide-over', 'at-top', 1000, 2500)
    const { tracker } = makeTracker()
    moInstances[0]?.callback([], {} as MutationObserver)
    tracker.destroy()
    expect(moInstances[0]?.disconnectCount).toBe(1)
    expect(raf.pendingCount).toBe(0)
  })
})
