import { mapPanelSettings } from '@ts/elementor/mapPanelSettings'
import { describe, expect, it } from 'vitest'

describe('mapPanelSettings', () => {
  it('maps the three On Scroll behaviors onto the options schema (primary header)', () => {
    expect(mapPanelSettings({ onScroll: '', isPrimary: true })).toEqual({ sticky: false })
    expect(mapPanelSettings({ onScroll: 'sticky', isPrimary: true })).toEqual({
      sticky: { reveal: false }
    })
    expect(mapPanelSettings({ onScroll: 'auto-hide', isPrimary: true })).toEqual({
      sticky: { reveal: true }
    })
  })

  it('keeps a secondary header off the page globals: no height publishing, no zone reactions', () => {
    expect(mapPanelSettings({ onScroll: 'auto-hide', isPrimary: false })).toEqual({
      sticky: { reveal: true, zones: false },
      heightObserver: false
    })
    expect(mapPanelSettings({ onScroll: 'sticky', isPrimary: false })).toEqual({
      sticky: { reveal: false, zones: false },
      heightObserver: false
    })
    expect(mapPanelSettings({ onScroll: '', isPrimary: false })).toEqual({
      sticky: false,
      heightObserver: false
    })
  })

  it('treats junk values as None — the machinery stays off', () => {
    expect(mapPanelSettings({ onScroll: 'bounce', isPrimary: true })).toEqual({ sticky: false })
    expect(mapPanelSettings({ onScroll: undefined, isPrimary: true })).toEqual({ sticky: false })
  })

  it('never emits toggleAttributes — the editor leaves the attribute swap at the engine default', () => {
    const mapped = mapPanelSettings({ onScroll: 'auto-hide', isPrimary: true })
    expect(mapped.sticky !== false && 'toggleAttributes' in (mapped.sticky ?? {})).toBe(false)
  })
})
