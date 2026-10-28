// @vitest-environment happy-dom
import {
  estimateNaturalTop,
  measureClearance,
  measureNaturalTop,
  measurePinLine,
  measureStickyTop,
  registerRevealOffsetProperty
} from '@ts/sticky/measure'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setScroll, setScrollBounds } from '../support'

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

beforeEach(() => {
  setScroll(0, 0)
  setScrollBounds(5000, 800)
})

afterEach(() => {
  document.body.innerHTML = ''
  document.documentElement.style.marginTop = ''
  setScroll(0, 0)
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

describe('estimateNaturalTop fallbacks', () => {
  it('is 0 for a wrapper with no sibling and no parent', () => {
    expect(estimateNaturalTop(document.createElement('div'))).toBe(0)
  })

  it('is 0 for a detached value host with nothing around it', () => {
    const host = document.createElement('div')
    host.className = 'arts-header-values js-arts-header-values'
    const wrapper = document.createElement('div')
    host.append(wrapper)
    expect(estimateNaturalTop(wrapper)).toBe(0)
  })

  it('prefers the previous sibling bottom, else the parent top, in document space', () => {
    setScroll(0, 300)
    const parent = document.createElement('div')
    const sibling = document.createElement('div')
    const wrapper = document.createElement('div')
    parent.append(sibling, wrapper)
    document.body.append(parent)
    vi.spyOn(parent, 'getBoundingClientRect').mockReturnValue({ top: -240 } as DOMRect)
    vi.spyOn(sibling, 'getBoundingClientRect').mockReturnValue({ bottom: -150 } as DOMRect)
    expect(estimateNaturalTop(wrapper)).toBe(150)
    sibling.remove()
    expect(estimateNaturalTop(wrapper)).toBe(60)
  })
})

describe('measureNaturalTop', () => {
  const top = { edge: 'top', offset: 32 } as const
  const bottom = { edge: 'bottom', offset: 24 } as const

  const makeWrapper = (position: string, rect: Partial<DOMRect>): HTMLElement => {
    const container = document.createElement('div')
    container.style.position = position
    container.getBoundingClientRect = () => rect as DOMRect
    document.body.appendChild(container)
    return container
  }

  it('takes the trigger rect in document space and ignores the wrapper entirely', () => {
    setScroll(0, 500)
    const trigger = document.createElement('div')
    trigger.getBoundingClientRect = () => ({ top: -99.6 }) as DOMRect
    const fixed = makeWrapper('fixed', { top: 0 })
    expect(measureNaturalTop(fixed, trigger, top)).toBe(400)
  })

  it('is null for fixed and absolute wrappers — their rect never reflects the slot', () => {
    expect(measureNaturalTop(makeWrapper('fixed', { top: 10 }), null, top)).toBeNull()
    expect(measureNaturalTop(makeWrapper('absolute', { top: 10 }), null, top)).toBeNull()
  })

  it('reads a static or relative wrapper rect in document space, rounded', () => {
    setScroll(0, 500)
    expect(measureNaturalTop(makeWrapper('', { top: -99.6 }), null, top)).toBe(400)
    expect(measureNaturalTop(makeWrapper('relative', { top: 12.4 }), null, top)).toBe(512)
  })

  it('trusts a sticky top-edge wrapper only once it sits clear of the pin line', () => {
    // Pinned at the line (or within the 1px slack): the rect says nothing about the slot.
    expect(measureNaturalTop(makeWrapper('sticky', { top: 32 }), null, top)).toBeNull()
    expect(measureNaturalTop(makeWrapper('sticky', { top: 33 }), null, top)).toBeNull()
    expect(measureNaturalTop(makeWrapper('sticky', { top: 34 }), null, top)).toBe(34)
  })

  it('trusts a sticky bottom-edge wrapper only once it sits above the bottom slot line', () => {
    // Viewport 800, offset 24: clear while rect.bottom < 775.
    expect(
      measureNaturalTop(makeWrapper('sticky', { top: 700, bottom: 775 }), null, bottom)
    ).toBeNull()
    expect(measureNaturalTop(makeWrapper('sticky', { top: 700, bottom: 774 }), null, bottom)).toBe(
      700
    )
  })
})

describe('measureClearance', () => {
  const makeBar = (): HTMLElement => {
    const bar = document.createElement('div')
    bar.getBoundingClientRect = () => ({ top: 10, bottom: 90, height: 80 }) as DOMRect
    document.body.appendChild(bar)
    return bar
  }

  const mark = (bar: HTMLElement, bottom: number): HTMLElement => {
    const el = document.createElement('li')
    el.setAttribute('data-arts-header-extent', '')
    el.getBoundingClientRect = () => ({ bottom }) as DOMRect
    bar.appendChild(el)
    return el
  }

  it('equals the bar height when nothing is marked', () => {
    expect(measureClearance(makeBar())).toBe(80)
  })

  it('counts a visible marked element, asking visibility to include the visibility property', () => {
    const bar = makeBar()
    const el = mark(bar, 210)
    const checkVisibility = vi.fn(() => true)
    el.checkVisibility = checkVisibility
    expect(measureClearance(bar)).toBe(200)
    expect(checkVisibility).toHaveBeenCalledExactlyOnceWith({ visibilityProperty: true })
  })

  it('skips a marked element that does not paint', () => {
    const bar = makeBar()
    mark(bar, 210).checkVisibility = () => false
    expect(measureClearance(bar)).toBe(80)
  })

  it('counts a marked element on an engine without checkVisibility', () => {
    const bar = makeBar()
    const el = mark(bar, 210)
    Object.defineProperty(el, 'checkVisibility', { value: undefined, configurable: true })
    expect(measureClearance(bar)).toBe(200)
  })

  it('never lets a marked element inside the bar shrink the clearance', () => {
    const bar = makeBar()
    mark(bar, 50).checkVisibility = () => true
    expect(measureClearance(bar)).toBe(80)
  })
})

describe('registerRevealOffsetProperty', () => {
  it('registers a custom name as an inheriting px-resolved length', () => {
    const registerProperty = vi.fn()
    vi.stubGlobal('CSS', { registerProperty })
    registerRevealOffsetProperty('--custom-offset')
    expect(registerProperty).toHaveBeenCalledExactlyOnceWith({
      name: '--custom-offset',
      syntax: '<length>',
      inherits: true,
      initialValue: '0px'
    })
  })

  it('swallows the duplicate-registration throw — the first registration in a realm stands', () => {
    vi.stubGlobal('CSS', {
      registerProperty: vi.fn(() => {
        throw new DOMException('already registered', 'InvalidModificationError')
      })
    })
    expect(() => registerRevealOffsetProperty('--custom-offset')).not.toThrow()
  })

  it('is a no-op where CSS or registerProperty does not exist', () => {
    vi.stubGlobal('CSS', {})
    expect(() => registerRevealOffsetProperty('--custom-offset')).not.toThrow()
    vi.stubGlobal('CSS', undefined)
    expect(() => registerRevealOffsetProperty('--custom-offset')).not.toThrow()
  })
})
