// @vitest-environment happy-dom
import { estimateNaturalTop, measurePinLine, measureStickyTop } from '@ts/sticky/measure'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The admin-bar term of the pin line. WordPress keeps `<html>` margin-top (and
 * `--wp-admin--admin-bar--height`) at 46px below 600px even though it drops #wpadminbar to
 * `position: absolute` there, so the engine must take the styles' resolved viewport-pinned var
 * instead — the one value that knows the difference.
 */

const makeContainer = (pinnedTop: string): HTMLElement => {
  const container = document.createElement('div')
  container.style.setProperty('--arts-header-top-pinned', pinnedTop)
  document.body.appendChild(container)
  return container
}

afterEach(() => {
  document.body.innerHTML = ''
  document.documentElement.style.marginTop = ''
})

describe('measureStickyTop', () => {
  it('reads the pinned var off the container and ignores the `<html>` bump', () => {
    document.documentElement.style.marginTop = '46px'
    expect(measureStickyTop(makeContainer('0px'))).toBe(0)
  })

  it('keeps the full height while the bar is still viewport-pinned', () => {
    expect(measureStickyTop(makeContainer('32px'))).toBe(32)
  })

  it('resolves to 0 with no admin bar, and never inverts the line', () => {
    const bare = document.createElement('div')
    document.body.appendChild(bare)
    expect(measureStickyTop(bare)).toBe(0)
    expect(measureStickyTop(makeContainer('-20px'))).toBe(0)
  })
})

describe('measurePinLine', () => {
  it('falls back to the pinned admin-bar term for an overlay fixed wrapper', () => {
    const container = makeContainer('0px')
    container.style.position = 'fixed'
    expect(measurePinLine(container)).toEqual({ edge: 'top', offset: 0 })
  })
})

describe('estimateNaturalTop with a value host', () => {
  it('uses the outer slot sibling instead of the boxless host rectangle', () => {
    const sibling = document.createElement('div')
    const host = document.createElement('div')
    const wrapper = document.createElement('div')
    host.className = 'arts-header-values js-arts-header-values'
    host.append(wrapper)
    document.body.append(sibling, host)
    vi.spyOn(sibling, 'getBoundingClientRect').mockReturnValue({ bottom: 150 } as DOMRect)
    const hostRect = vi.spyOn(host, 'getBoundingClientRect')
    expect(estimateNaturalTop(wrapper)).toBe(150 + window.scrollY)
    expect(hostRect).not.toHaveBeenCalled()
  })

  it('does not skip an unrelated display:contents parent', () => {
    const parent = document.createElement('div')
    parent.style.display = 'contents'
    const wrapper = document.createElement('div')
    parent.append(wrapper)
    document.body.append(parent)
    vi.spyOn(parent, 'getBoundingClientRect').mockReturnValue({ top: 90 } as DOMRect)
    expect(estimateNaturalTop(wrapper)).toBe(90 + window.scrollY)
  })
})
