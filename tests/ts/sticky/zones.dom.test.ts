// @vitest-environment happy-dom
import { HS_LAYOUT_EVENT } from '@ts/sticky/horizontalScroll'
import { createZoneTracker } from '@ts/sticky/zones'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeMutationObserver, fakeRaf } from '../support'

const trackers: { destroy(): void }[] = []

afterEach(() => {
  for (const tracker of trackers.splice(0)) {
    tracker.destroy()
  }
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
    container: document.body,
    getPinLine: () => 0,
    getBarHeight: () => 80,
    getViewportH: () => 900,
    getDecider: () => 40,
    onChange
  })
  trackers.push(tracker)
  return { tracker, onChange }
}

const addPanelZone = (kind: string, geometry: string, top: number, bottom: number): HTMLElement => {
  const el = addZone('data-arts-header-zone', '', top, bottom)
  el.style.setProperty('--arts-header-zone', kind)
  el.style.setProperty('--arts-header-zone-geometry', geometry)
  return el
}

describe('createZoneTracker', () => {
  it('resolves a panel zone kind and geometry from its CSS vars, skipping none', () => {
    addPanelZone('hide', 'at-top', 1000, 2500)
    addPanelZone('lock', 'in-view', 4000, 4500)
    addPanelZone('none', 'at-top', 6000, 7000)
    const { tracker, onChange } = makeTracker()
    tracker.evaluate(1200)
    expect(onChange).toHaveBeenLastCalledWith(true, false, false, false)
    tracker.evaluate(3200)
    expect(onChange).toHaveBeenLastCalledWith(false, true, false, false)
    tracker.evaluate(6200)
    expect(onChange).toHaveBeenLastCalledWith(false, false, false, false)
  })

  it('falls back to the desktop kind:geometry in the marker while the vars are unwritten', () => {
    const el = addZone('data-arts-header-zone', 'lock:in-view', 1000, 2500)
    const { tracker, onChange } = makeTracker()
    tracker.evaluate(0)
    expect(onChange).not.toHaveBeenCalled()
    tracker.evaluate(1200)
    expect(onChange).toHaveBeenLastCalledWith(false, true, false, false)
    // An explicit var beats the fallback: tablet-style 'none' switches the zone off.
    el.style.setProperty('--arts-header-zone', 'none')
    tracker.refresh(1200)
    expect(onChange).toHaveBeenLastCalledWith(false, false, false, false)
  })

  it('re-reads the vars on refresh, so a breakpoint change flips the zone', () => {
    const zone = addPanelZone('hide', 'at-top', 1000, 2500)
    const { tracker, onChange } = makeTracker()
    tracker.evaluate(1200)
    expect(onChange).toHaveBeenLastCalledWith(true, false, false, false)
    zone.style.setProperty('--arts-header-zone', 'none')
    tracker.refresh(1200)
    expect(onChange).toHaveBeenLastCalledWith(false, false, false, false)
  })

  it('caches doc-space rects at scan and drives both kinds from pure geometry on evaluate', () => {
    addZone('data-arts-header-hide-over', 'at-top', 1000, 2500)
    addZone('data-arts-header-lock-over', 'in-view', 4000, 4500)
    const { tracker, onChange } = makeTracker()
    tracker.evaluate(1200)
    expect(onChange).toHaveBeenLastCalledWith(true, false, false, false)
    tracker.evaluate(3200)
    expect(onChange).toHaveBeenLastCalledWith(false, true, false, false)
    tracker.evaluate(0)
    expect(onChange).toHaveBeenLastCalledWith(false, false, false, false)
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
    expect(onChange).toHaveBeenLastCalledWith(true, false, false, false)
    // The zone attribute is removed; a burst of mutations schedules exactly one rAF rescan.
    zone.removeAttribute('data-arts-header-hide-over')
    const observer = {} as MutationObserver
    moInstances[0]?.callback([], observer)
    moInstances[0]?.callback([], observer)
    expect(raf.pendingCount).toBe(1)
    raf.step()
    expect(onChange).toHaveBeenLastCalledWith(false, false, false, false)
  })

  it('refresh re-scans and re-evaluates at the last known scroll position', () => {
    const { tracker, onChange } = makeTracker()
    tracker.evaluate(1200)
    expect(onChange).not.toHaveBeenCalled()
    addZone('data-arts-header-hide-over', 'at-top', 1000, 2500)
    tracker.refresh()
    expect(onChange).toHaveBeenLastCalledWith(true, false, false, false)
  })

  it('refresh(y) evaluates at the given position, not the stale tick one', () => {
    addZone('data-arts-header-hide-over', 'at-top', 1000, 2500)
    const { tracker, onChange } = makeTracker()
    tracker.evaluate(0)
    expect(onChange).not.toHaveBeenCalled()
    tracker.refresh(1200)
    expect(onChange).toHaveBeenLastCalledWith(true, false, false, false)
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

  it('tracks a hand-authored alt-over zone with the center rule', () => {
    addZone('data-arts-header-alt-over', '', 1000, 1600)
    const { tracker, onChange } = makeTracker()
    tracker.evaluate(959)
    expect(onChange).not.toHaveBeenCalled()
    tracker.evaluate(960)
    expect(onChange).toHaveBeenLastCalledWith(false, false, false, true)
    tracker.evaluate(1560)
    expect(onChange).toHaveBeenLastCalledWith(false, false, false, false)
  })

  it('reports an alt-only transition', () => {
    addZone('data-arts-header-alt-over', '', 1000, 1600)
    const { tracker, onChange } = makeTracker()
    tracker.evaluate(960)
    tracker.evaluate(1000)
    expect(onChange).toHaveBeenCalledTimes(1)
    tracker.evaluate(0)
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('resolves a panel look zone from its var, falling back to the marker', () => {
    const viaVar = addZone('data-arts-header-zone-look', '', 1000, 1600)
    viaVar.style.setProperty('--arts-header-zone-look', 'alt')
    const { tracker, onChange } = makeTracker()
    tracker.evaluate(960)
    expect(onChange).toHaveBeenLastCalledWith(false, false, false, true)

    // Marker-only element: no var written yet, the desktop value in the attribute decides.
    viaVar.remove()
    addZone('data-arts-header-zone-look', 'alt', 1000, 1600)
    tracker.refresh(960)
    expect(onChange).toHaveBeenLastCalledWith(false, false, false, true)
  })

  it('treats a default var as no zone even when the marker says alt', () => {
    const el = addZone('data-arts-header-zone-look', 'alt', 1000, 1600)
    el.style.setProperty('--arts-header-zone-look', 'default')
    const { tracker, onChange } = makeTracker()
    tracker.evaluate(960)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('treats an empty marker with no var as no zone', () => {
    addZone('data-arts-header-zone-look', '', 1000, 1600)
    const { tracker, onChange } = makeTracker()
    tracker.evaluate(960)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('yields a hide zone AND an alt zone from one container', () => {
    const el = addZone('data-arts-header-zone', 'hide:overlap', 1000, 1600)
    el.setAttribute('data-arts-header-zone-look', 'alt')
    el.style.setProperty('--arts-header-zone-look', 'alt')
    const { tracker, onChange } = makeTracker()
    tracker.evaluate(960)
    expect(onChange).toHaveBeenLastCalledWith(true, false, false, true)
  })

  it('tracks nested marked containers independently', () => {
    const parent = addZone('data-arts-header-zone-look', 'alt', 1000, 3000)
    parent.style.setProperty('--arts-header-zone-look', 'alt')
    const child = document.createElement('div')
    child.setAttribute('data-arts-header-hide-over', 'at-top')
    child.getBoundingClientRect = () => ({ top: 1200, bottom: 1400 }) as DOMRect
    parent.appendChild(child)
    const { tracker, onChange } = makeTracker()
    // Center line y + 40 = 1140: inside the alt parent only; the child isn't at the top line yet.
    tracker.evaluate(1100)
    expect(onChange).toHaveBeenLastCalledWith(false, false, false, true)
    // The child spans the top line: hide flips on while alt stays on.
    tracker.evaluate(1300)
    expect(onChange).toHaveBeenLastCalledWith(true, false, false, true)
    // Past the child's bottom, still inside the parent: hide flips off, alt stays on.
    tracker.evaluate(1500)
    expect(onChange).toHaveBeenLastCalledWith(false, false, false, true)
    // 2960 + 40 = 3000: past the parent's exclusive bottom.
    tracker.evaluate(2960)
    expect(onChange).toHaveBeenLastCalledWith(false, false, false, false)
  })

  it('tracks a valued alt-over attribute with the center rule, not its value', () => {
    addZone('data-arts-header-alt-over', 'overlap', 1000, 1600)
    const { tracker, onChange } = makeTracker()
    // The overlap rule would already be active at 959; the center rule is not.
    tracker.evaluate(959)
    expect(onChange).not.toHaveBeenCalled()
    tracker.evaluate(960)
    expect(onChange).toHaveBeenLastCalledWith(false, false, false, true)
  })

  it('rescans when the alt-over or zone-look attribute mutates', () => {
    const moInstances = fakeMutationObserver()
    makeTracker()
    const options = moInstances[0]?.observed[0]?.options as MutationObserverInit | undefined
    const filter = options?.attributeFilter
    expect(filter).toContain('data-arts-header-alt-over')
    expect(filter).toContain('data-arts-header-zone-look')
  })

  it('drives hold from a panel zone var, independent of lock', () => {
    addPanelZone('hold', 'in-view', 1000, 1600)
    const { tracker, onChange } = makeTracker()
    tracker.evaluate(0)
    expect(onChange).not.toHaveBeenCalled()
    tracker.evaluate(1200)
    expect(onChange).toHaveBeenLastCalledWith(false, false, true, false)
  })

  describe('ignored subtrees', () => {
    // One builder per scan site; each zone is active at y 1200 when it is NOT ignored.
    const sites: [string, () => HTMLElement][] = [
      ['hide-over', () => addZone('data-arts-header-hide-over', 'at-top', 1000, 1600)],
      ['lock-over', () => addZone('data-arts-header-lock-over', 'at-top', 1000, 1600)],
      ['alt-over', () => addZone('data-arts-header-alt-over', '', 1000, 1600)],
      ['panel zone', () => addPanelZone('hide', 'at-top', 1000, 1600)],
      [
        'panel look zone',
        () => {
          const el = addZone('data-arts-header-zone-look', '', 1000, 1600)
          el.style.setProperty('--arts-header-zone-look', 'alt')
          return el
        }
      ]
    ]

    it.each(sites)('%s: tracked while the page is live', (_name, build) => {
      build()
      const { tracker, onChange } = makeTracker()
      tracker.evaluate(1200)
      expect(onChange).toHaveBeenCalledTimes(1)
    })

    it.each(sites)('%s: skipped inside a stamped subtree', (_name, build) => {
      const leaving = document.createElement('div')
      leaving.setAttribute('data-arts-header-ignore', '')
      document.body.appendChild(leaving)
      leaving.appendChild(build())
      const { tracker, onChange } = makeTracker()
      tracker.evaluate(1200)
      expect(onChange).not.toHaveBeenCalled()
    })

    it.each(sites)('%s: skipped when the zone element itself is stamped', (_name, build) => {
      build().setAttribute('data-arts-header-ignore', '')
      const { tracker, onChange } = makeTracker()
      tracker.evaluate(1200)
      expect(onChange).not.toHaveBeenCalled()
    })

    it('drops a live zone on the next scan once its page is stamped', () => {
      const leaving = document.createElement('div')
      document.body.appendChild(leaving)
      leaving.appendChild(addZone('data-arts-header-hide-over', 'at-top', 1000, 1600))
      const { tracker, onChange } = makeTracker()
      tracker.evaluate(1200)
      expect(onChange).toHaveBeenLastCalledWith(true, false, false, false)
      leaving.setAttribute('data-arts-header-ignore', '')
      tracker.refresh(1200)
      expect(onChange).toHaveBeenLastCalledWith(false, false, false, false)
    })

    it('rescans when the ignore marker mutates', () => {
      const moInstances = fakeMutationObserver()
      makeTracker()
      const options = moInstances[0]?.observed[0]?.options as MutationObserverInit | undefined
      expect(options?.attributeFilter).toContain('data-arts-header-ignore')
    })
  })

  describe('horizontal sections', () => {
    const range = {
      start: 1550,
      end: 2650,
      onStageAtEngage: false,
      onStageAtRelease: false,
      stageTop: 0,
      stageHeight: 800
    }

    interface IRigParts {
      container: HTMLElement
      section: HTMLElement
      panel: HTMLElement
    }

    /** A header container, a `.js-arts-hs` section and one marked panel inside it. */
    const makeHorizontalRig = (
      getScrollRange: () => typeof range | null,
      prepare?: (parts: IRigParts) => void
    ) => {
      vi.stubGlobal('artsHorizontalScroll', { contract: 1, getScrollRange })
      const container = document.createElement('div')
      container.getBoundingClientRect = () =>
        ({ top: 0, bottom: 80, left: 0, width: 500 }) as DOMRect
      document.body.appendChild(container)
      const section = document.createElement('div')
      section.className = 'js-arts-hs'
      section.getBoundingClientRect = () =>
        ({ top: 1000, bottom: 4000, left: 0, width: 1000 }) as DOMRect
      const panel = document.createElement('div')
      panel.setAttribute('data-arts-header-hide-over', 'at-top')
      // The panel's own rect is meaningless while pinned; it must not drive the zone.
      panel.getBoundingClientRect = () => ({ top: 1000, bottom: 2500 }) as DOMRect
      section.appendChild(panel)
      document.body.appendChild(section)
      prepare?.({ container, section, panel })
      const onChange = vi.fn()
      const tracker = createZoneTracker({
        container,
        getPinLine: () => 0,
        getBarHeight: () => 80,
        getViewportH: () => 900,
        getDecider: () => 40,
        onChange
      })
      trackers.push(tracker)
      return { tracker, onChange, panel }
    }

    it('tracks a hide zone inside a horizontal section with the center rule and the window path', () => {
      const { tracker, onChange } = makeHorizontalRig(() => range)
      tracker.evaluate(1549)
      expect(onChange).not.toHaveBeenCalled()
      tracker.evaluate(1550)
      expect(onChange).toHaveBeenLastCalledWith(true, false, false, false)
    })

    it('moves panel zones from the rect path to the window path on arts-hs:layout', () => {
      const raf = fakeRaf()
      let current: typeof range | null = null
      const { tracker, onChange } = makeHorizontalRig(() => current)
      // Null range: the element's own rect drives (at-top over 1000..2500).
      tracker.evaluate(1200)
      expect(onChange).toHaveBeenLastCalledWith(true, false, false, false)
      current = range
      document.dispatchEvent(new CustomEvent(HS_LAYOUT_EVENT, { bubbles: true }))
      raf.step()
      // The window path now drives: 1200 + 40 sits before the window opening at 1590.
      expect(onChange).toHaveBeenLastCalledWith(false, false, false, false)
      tracker.evaluate(1550)
      expect(onChange).toHaveBeenLastCalledWith(true, false, false, false)
    })

    it('removes a panel whose pinned band misses the decider line', () => {
      const { tracker, onChange } = makeHorizontalRig(() => ({
        ...range,
        stageTop: 80,
        stageHeight: 700
      }))
      tracker.evaluate(1700)
      expect(onChange).not.toHaveBeenCalled()
    })

    it('stops rescanning on the layout event after destroy', () => {
      const raf = fakeRaf()
      const getScrollRange = vi.fn(() => range)
      const { tracker } = makeHorizontalRig(getScrollRange)
      expect(getScrollRange).toHaveBeenCalledTimes(1)
      document.dispatchEvent(new CustomEvent(HS_LAYOUT_EVENT, { bubbles: true }))
      raf.step()
      expect(getScrollRange).toHaveBeenCalledTimes(2)
      tracker.destroy()
      document.dispatchEvent(new CustomEvent(HS_LAYOUT_EVENT, { bubbles: true }))
      expect(raf.pendingCount).toBe(0)
      raf.step()
      expect(getScrollRange).toHaveBeenCalledTimes(2)
    })

    it('asks for the window at the header center, as a fraction of the section width', () => {
      const getScrollRange = vi.fn(() => range)
      const { panel } = makeHorizontalRig(getScrollRange)
      // Container center x 250 over a 1000px-wide section starting at 0.
      expect(getScrollRange).toHaveBeenCalledExactlyOnceWith(panel, { point: 0.25 })
    })

    it('reads the container rect once per scan however many panels ask, and not at all otherwise', () => {
      const containerRect = vi.fn(() => ({ top: 0, bottom: 80, left: 0, width: 500 }) as DOMRect)
      const { tracker } = makeHorizontalRig(
        () => range,
        ({ container, section }) => {
          container.getBoundingClientRect = containerRect
          const second = document.createElement('div')
          second.setAttribute('data-arts-header-lock-over', 'at-top')
          section.appendChild(second)
        }
      )
      expect(containerRect).toHaveBeenCalledTimes(1)
      tracker.refresh(0)
      expect(containerRect).toHaveBeenCalledTimes(2)
    })

    it('never reads the container rect when no zone sits in a horizontal section', () => {
      const containerRect = vi.fn(() => ({ top: 0, bottom: 80, left: 0, width: 500 }) as DOMRect)
      const { tracker } = makeHorizontalRig(
        () => range,
        ({ container, section }) => {
          container.getBoundingClientRect = containerRect
          section.remove()
          addZone('data-arts-header-hide-over', 'at-top', 1000, 1600)
        }
      )
      tracker.evaluate(1200)
      expect(containerRect).not.toHaveBeenCalled()
    })

    it.each([
      ['upper edge exclusive', 0, 40, false],
      ['upper edge reached from inside', 0, 41, true],
      ['lower edge inclusive', 40, 40, true]
    ])('band gate at the decider line (40): %s', (_name, stageTop, stageHeight, kept) => {
      const { tracker, onChange } = makeHorizontalRig(() => ({ ...range, stageTop, stageHeight }))
      tracker.evaluate(1700)
      if (kept) {
        expect(onChange).toHaveBeenLastCalledWith(true, false, false, false)
      } else {
        expect(onChange).not.toHaveBeenCalled()
      }
    })

    it.each([
      [
        'lock',
        (panel: HTMLElement) => {
          panel.removeAttribute('data-arts-header-hide-over')
          panel.setAttribute('data-arts-header-lock-over', 'in-view')
        },
        [false, true, false, false]
      ],
      [
        'hold',
        (panel: HTMLElement) => {
          panel.removeAttribute('data-arts-header-hide-over')
          panel.setAttribute('data-arts-header-zone', 'hold:in-view')
        },
        [false, false, true, false]
      ]
    ] as const)('forces a %s zone to the center rule and the window path', (_kind, configure, expected) => {
      const { tracker, onChange } = makeHorizontalRig(
        () => range,
        ({ panel }) => configure(panel)
      )
      // The panel's own rect [1000, 2500] would be in view here; the window opens at 1550.
      tracker.evaluate(1200)
      expect(onChange).not.toHaveBeenCalled()
      tracker.evaluate(1549)
      expect(onChange).not.toHaveBeenCalled()
      tracker.evaluate(1550)
      expect(onChange).toHaveBeenLastCalledWith(...expected)
      tracker.evaluate(2650)
      expect(onChange).toHaveBeenLastCalledWith(false, false, false, false)
    })
  })
})
