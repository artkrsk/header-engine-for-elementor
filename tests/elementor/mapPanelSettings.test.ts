import { mapPanelSettings } from '@ts/elementor/mapPanelSettings'
import { describe, expect, it } from 'vitest'

describe('mapPanelSettings', () => {
  it('disables the whole sticky section when the sticky toggle is off — reveal cannot survive it', () => {
    expect(mapPanelSettings({ stickyEnabled: '', toggleRevealEnabled: 'yes' })).toEqual({
      sticky: false
    })
  })

  it('maps sticky + reveal toggles into the nested options shape', () => {
    expect(mapPanelSettings({ stickyEnabled: 'yes', toggleRevealEnabled: 'yes' })).toEqual({
      sticky: { reveal: {} }
    })
    expect(mapPanelSettings({ stickyEnabled: 'yes', toggleRevealEnabled: '' })).toEqual({
      sticky: { reveal: false }
    })
  })

  it('never emits toggleAttributes — the editor leaves the attribute swap at the engine default', () => {
    const mapped = mapPanelSettings({ stickyEnabled: 'yes', toggleRevealEnabled: 'yes' })
    expect(mapped.sticky !== false && 'toggleAttributes' in (mapped.sticky ?? {})).toBe(false)
  })
})
