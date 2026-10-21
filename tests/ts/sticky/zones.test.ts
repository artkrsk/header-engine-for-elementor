import {
  readZoneKind,
  readZoneLook,
  readZoneMode,
  reduceZones,
  resolveCenterActive,
  resolveZoneActive
} from '@ts/sticky/zones'
import { describe, expect, it } from 'vitest'

describe('readZoneMode', () => {
  it('passes the two explicit geometries through verbatim', () => {
    expect(readZoneMode('overlap')).toBe('overlap')
    expect(readZoneMode('in-view')).toBe('in-view')
  })

  it('defaults anything unrecognized or missing to at-top', () => {
    expect(readZoneMode('at-top')).toBe('at-top')
    expect(readZoneMode('bounce')).toBe('at-top')
    expect(readZoneMode(null)).toBe('at-top')
    expect(readZoneMode('')).toBe('at-top')
    // `center` is engine-internal geometry, never read from an attribute.
    expect(readZoneMode('center')).toBe('at-top')
  })
})

describe('readZoneLook', () => {
  it('is true only for alt', () => {
    expect(readZoneLook('alt')).toBe(true)
    expect(readZoneLook(' alt ')).toBe(true)
    expect(readZoneLook('')).toBe(false)
    expect(readZoneLook('default')).toBe(false)
    expect(readZoneLook('none')).toBe(false)
  })
})

describe('readZoneKind', () => {
  it('accepts only hide and lock; none, unset and junk are no zone', () => {
    expect(readZoneKind('hide')).toBe('hide')
    expect(readZoneKind('lock')).toBe('lock')
    expect(readZoneKind('none')).toBeNull()
    expect(readZoneKind('')).toBeNull()
    expect(readZoneKind('shrink')).toBeNull()
  })
})

describe('resolveZoneActive', () => {
  // Zone doc-space rect [1000, 2500]; viewport 900 tall.
  it('at-top: active only while the zone spans the viewport top line', () => {
    expect(resolveZoneActive('at-top', 1000, 2500, 999, 900, 0, 80)).toBe(false)
    expect(resolveZoneActive('at-top', 1000, 2500, 1000, 900, 0, 80)).toBe(true)
    expect(resolveZoneActive('at-top', 1000, 2500, 2499, 900, 0, 80)).toBe(true)
    expect(resolveZoneActive('at-top', 1000, 2500, 2500, 900, 0, 80)).toBe(false)
  })

  it('overlap: active while the zone intersects the header strip [pinLine, pinLine+barHeight]', () => {
    // Strip [32, 112]: zone enters it when its top rises above 112.
    expect(resolveZoneActive('overlap', 1000, 2500, 887, 900, 32, 80)).toBe(false)
    expect(resolveZoneActive('overlap', 1000, 2500, 889, 900, 32, 80)).toBe(true)
    // Leaves when its bottom clears the strip top (32): y past 2468.
    expect(resolveZoneActive('overlap', 1000, 2500, 2467, 900, 32, 80)).toBe(true)
    expect(resolveZoneActive('overlap', 1000, 2500, 2468, 900, 32, 80)).toBe(false)
  })

  it('in-view: active on any viewport intersection', () => {
    expect(resolveZoneActive('in-view', 1000, 2500, 99, 900, 0, 80)).toBe(false)
    expect(resolveZoneActive('in-view', 1000, 2500, 101, 900, 0, 80)).toBe(true)
    expect(resolveZoneActive('in-view', 1000, 2500, 2499, 900, 0, 80)).toBe(true)
    expect(resolveZoneActive('in-view', 1000, 2500, 2500, 900, 0, 80)).toBe(false)
  })
})

describe('resolveCenterActive', () => {
  it('is active while the decider line lies inside the rect', () => {
    expect(resolveCenterActive(1000, 1600, 960, 40)).toBe(true)
    expect(resolveCenterActive(1000, 1600, 959, 40)).toBe(false)
    expect(resolveCenterActive(1000, 1600, 1559, 40)).toBe(true)
    expect(resolveCenterActive(1000, 1600, 1560, 40)).toBe(false)
  })
})

describe('reduceZones', () => {
  it('drives a kind from any single active zone of that kind', () => {
    expect(
      reduceZones([
        { kind: 'hide', active: false },
        { kind: 'hide', active: true }
      ])
    ).toEqual({ anyHide: true, anyLock: false, anyAlt: false })
  })

  it('combines the two kinds independently', () => {
    expect(
      reduceZones([
        { kind: 'hide', active: true },
        { kind: 'lock', active: true }
      ])
    ).toEqual({ anyHide: true, anyLock: true, anyAlt: false })
  })

  it('reports all-clear for no zones at all', () => {
    expect(reduceZones([])).toEqual({ anyHide: false, anyLock: false, anyAlt: false })
  })

  it('drives alt independently of hide and lock', () => {
    expect(
      reduceZones([
        { kind: 'alt', active: true },
        { kind: 'hide', active: false },
        { kind: 'lock', active: false }
      ])
    ).toEqual({ anyHide: false, anyLock: false, anyAlt: true })
  })
})
