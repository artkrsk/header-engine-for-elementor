// @vitest-environment happy-dom
import { measureHorizontalZone } from '@ts/sticky/horizontalScroll'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setScroll } from '../support'

afterEach(() => {
  document.body.innerHTML = ''
  setScroll(0, 0)
})

const range = {
  start: 1550,
  end: 2650,
  onStageAtEngage: false,
  onStageAtRelease: false,
  stageTop: 0,
  stageHeight: 800
}

const makeSection = () => {
  const section = document.createElement('div')
  section.className = 'js-arts-hs'
  section.getBoundingClientRect = () =>
    ({ top: 1000, bottom: 4000, left: 0, width: 1000 }) as DOMRect
  const panel = document.createElement('div')
  section.appendChild(panel)
  document.body.appendChild(section)
  return { section, panel }
}

describe('measureHorizontalZone', () => {
  it('returns undefined outside a horizontal section, without a global, or on a null range', () => {
    const getScrollRange = vi.fn(() => null)
    vi.stubGlobal('artsHorizontalScroll', { contract: 1, getScrollRange })
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    expect(measureHorizontalZone(outside, () => 250, 40)).toBeUndefined()
    expect(getScrollRange).not.toHaveBeenCalled()
    const { panel } = makeSection()
    expect(measureHorizontalZone(panel, () => 250, 40)).toBeUndefined()
    expect(getScrollRange).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
    expect(measureHorizontalZone(panel, () => 250, 40)).toBeUndefined()
  })

  it('passes the stage point of the container center and returns the synthetic rect', () => {
    const getScrollRange = vi.fn(() => range)
    vi.stubGlobal('artsHorizontalScroll', { contract: 1, getScrollRange })
    const { panel } = makeSection()
    expect(measureHorizontalZone(panel, () => 250, 40)).toEqual({ top: 1590, bottom: 2690 })
    expect(getScrollRange).toHaveBeenCalledWith(panel, { point: 0.25 })
  })

  it('reports drop when the band gate rejects', () => {
    vi.stubGlobal('artsHorizontalScroll', {
      contract: 1,
      getScrollRange: () => ({ ...range, stageTop: 80, stageHeight: 700 })
    })
    const { panel } = makeSection()
    expect(measureHorizontalZone(panel, () => 250, 40)).toBe('drop')
  })

  it('ignores a global without getScrollRange or with contract 0', () => {
    const { panel } = makeSection()
    vi.stubGlobal('artsHorizontalScroll', { contract: 1 })
    expect(measureHorizontalZone(panel, () => 250, 40)).toBeUndefined()
    vi.stubGlobal('artsHorizontalScroll', { contract: 0, getScrollRange: () => range })
    expect(measureHorizontalZone(panel, () => 250, 40)).toBeUndefined()
  })

  describe('when scrolled', () => {
    /** Section at document 1500..4500, read at scrollY 500, so its viewport rect is 1000..4000. */
    const makeScrolledSection = () => {
      setScroll(0, 500)
      return makeSection()
    }

    it('anchors an engage-on-stage range to the section document top', () => {
      vi.stubGlobal('artsHorizontalScroll', {
        contract: 1,
        getScrollRange: () => ({ ...range, onStageAtEngage: true })
      })
      const { panel } = makeScrolledSection()
      expect(measureHorizontalZone(panel, () => 250, 40)).toMatchObject({ top: 1500 })
    })

    it('anchors a release-on-stage range to the section document bottom', () => {
      vi.stubGlobal('artsHorizontalScroll', {
        contract: 1,
        getScrollRange: () => ({ ...range, onStageAtRelease: true })
      })
      const { panel } = makeScrolledSection()
      expect(measureHorizontalZone(panel, () => 250, 40)).toMatchObject({ bottom: 4500 })
    })
  })
})
