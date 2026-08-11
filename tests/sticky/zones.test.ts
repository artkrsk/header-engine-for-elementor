import { readZoneMode, reduceZones, zoneRootMargin } from '@ts/sticky/zones'
import { describe, expect, it } from 'vitest'

describe('readZoneMode', () => {
  it('passes the two explicit geometries through verbatim', () => {
    expect(readZoneMode('overlap')).toBe('overlap')
    expect(readZoneMode('in-view')).toBe('in-view')
  })

  it('defaults anything unrecognized or missing to at-top', () => {
    expect(readZoneMode('at-top')).toBe('at-top')
    expect(readZoneMode('bogus')).toBe('at-top')
    expect(readZoneMode('')).toBe('at-top')
    expect(readZoneMode(null)).toBe('at-top')
  })
})

describe('zoneRootMargin', () => {
  it('pins at-top to the viewport top edge line', () => {
    expect(zoneRootMargin('at-top', 32, 80, 900)).toBe('0px 0px -100% 0px')
  })

  it('shrinks the overlap root to the header strip', () => {
    // Strip is [32, 112] in a 900px viewport → 788px cut from the bottom.
    expect(zoneRootMargin('overlap', 32, 80, 900)).toBe('-32px 0px -788px 0px')
  })

  it('floors the overlap bottom inset at zero when the strip covers the viewport', () => {
    expect(zoneRootMargin('overlap', 0, 900, 600)).toBe('0px 0px 0px 0px')
  })

  it('leaves in-view at the bare viewport', () => {
    expect(zoneRootMargin('in-view', 32, 80, 900)).toBe('0px')
  })
})

describe('reduceZones', () => {
  it('drives a kind from any single active zone of that kind', () => {
    expect(
      reduceZones([
        { kind: 'hide', active: false },
        { kind: 'hide', active: true },
        { kind: 'lock', active: false }
      ])
    ).toEqual({ anyHide: true, anyLock: false })
  })

  it('combines the two kinds independently', () => {
    expect(
      reduceZones([
        { kind: 'hide', active: true },
        { kind: 'lock', active: true }
      ])
    ).toEqual({ anyHide: true, anyLock: true })
  })

  it('reports all-clear for no zones at all', () => {
    expect(reduceZones([])).toEqual({ anyHide: false, anyLock: false })
  })
})
