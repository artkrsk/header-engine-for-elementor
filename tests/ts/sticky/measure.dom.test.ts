// @vitest-environment happy-dom
import { measurePinLine, measureStickyTop } from '@ts/sticky/measure'
import { afterEach, describe, expect, it } from 'vitest'

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
