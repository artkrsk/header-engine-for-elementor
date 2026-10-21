import { resolveHorizontalZoneRect, stagePoint } from '@ts/sticky/horizontalScroll'
import { describe, expect, it } from 'vitest'

describe('stagePoint', () => {
  it('clamps the center into the stage', () => {
    expect(stagePoint(500, 0, 1000)).toBe(0.5)
    expect(stagePoint(45, 90, 1000)).toBe(0)
    expect(stagePoint(2000, 0, 1000)).toBe(1)
  })

  it('falls back to the middle on non-finite input or a zero width', () => {
    expect(stagePoint(Number.NaN, 0, 1000)).toBe(0.5)
    expect(stagePoint(500, Number.NaN, 1000)).toBe(0.5)
    expect(stagePoint(500, 0, 0)).toBe(0.5)
    expect(stagePoint(500, 0, Number.NaN)).toBe(0.5)
  })
})

describe('resolveHorizontalZoneRect', () => {
  const band = { stageTop: 0, stageHeight: 800 }

  it('maps an interior window by the decider', () => {
    expect(
      resolveHorizontalZoneRect(
        { start: 1550, end: 2650, onStageAtEngage: false, onStageAtRelease: false, ...band },
        1000,
        4000,
        40
      )
    ).toEqual({ top: 1590, bottom: 2690 })
  })

  it('opens an on-stage-at-engage panel at the section top', () => {
    expect(
      resolveHorizontalZoneRect(
        { start: 1000, end: 1550, onStageAtEngage: true, onStageAtRelease: false, ...band },
        1000,
        4000,
        40
      )
    ).toEqual({ top: 1000, bottom: 1590 })
  })

  it('holds an on-stage-at-release panel to the section bottom', () => {
    expect(
      resolveHorizontalZoneRect(
        { start: 2650, end: 3200, onStageAtEngage: false, onStageAtRelease: true, ...band },
        1000,
        4000,
        40
      )
    ).toEqual({ top: 2690, bottom: 4000 })
  })

  it('drops a panel whose pinned band misses the decider line', () => {
    expect(
      resolveHorizontalZoneRect(
        {
          start: 1550,
          end: 2650,
          onStageAtEngage: false,
          onStageAtRelease: false,
          stageTop: 80,
          stageHeight: 700
        },
        1000,
        4000,
        40
      )
    ).toBeNull()
  })

  it('skips the gate and treats a missing release flag as false on an older build', () => {
    expect(
      resolveHorizontalZoneRect({ start: 1550, end: 2650, onStageAtEngage: false }, 1000, 4000, 40)
    ).toEqual({ top: 1590, bottom: 2690 })
  })
})
