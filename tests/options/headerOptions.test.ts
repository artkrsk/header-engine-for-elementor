import { defaultHeaderOptions } from '@ts/constants'
import {
  resolveHeaderOptions,
  resolveHeightObserver,
  resolveReveal,
  resolveSticky
} from '@ts/options/headerOptions'
import { describe, expect, it } from 'vitest'

describe('resolveHeaderOptions', () => {
  it('fills every section with the canonical defaults when given nothing', () => {
    expect(resolveHeaderOptions()).toEqual({
      sticky: {
        trigger: undefined,
        reveal: { mode: 'auto-hide', offset: 0 },
        until: undefined,
        toggleAttributes: false
      },
      heightObserver: { observe: true, cleanupOnDestroy: false }
    })
  })

  it('passes a section-level false through concretely', () => {
    const resolved = resolveHeaderOptions({ sticky: false, heightObserver: false })
    expect(resolved.sticky).toBe(false)
    expect(resolved.heightObserver).toBe(false)
  })

  it('never aliases the defaults into a resolved object', () => {
    const resolved = resolveHeaderOptions()
    if (resolved.sticky === false || resolved.sticky.reveal === false) {
      throw new Error('defaults resolve to enabled sections')
    }
    resolved.sticky.reveal.offset = 999
    expect(defaultHeaderOptions.sticky).not.toBe(false)
    if (defaultHeaderOptions.sticky !== false && defaultHeaderOptions.sticky.reveal !== false) {
      expect(defaultHeaderOptions.sticky.reveal.offset).toBe(0)
    }
  })
})

describe('resolveReveal', () => {
  it('fills only the gaps a partial override leaves', () => {
    expect(resolveReveal({ offset: 50 })).toEqual({ mode: 'auto-hide', offset: 50 })
    expect(resolveReveal({ mode: 'scrub' })).toEqual({ mode: 'scrub', offset: 0 })
  })

  it('disables on false', () => {
    expect(resolveReveal(false)).toBe(false)
  })
})

describe('resolveSticky', () => {
  it('forwards trigger and until verbatim, including their absence', () => {
    const element = { nodeType: 1 } as unknown as HTMLElement
    const resolved = resolveSticky({ trigger: '.pin', until: element })
    expect(resolved).not.toBe(false)
    if (resolved !== false) {
      expect(resolved.trigger).toBe('.pin')
      expect(resolved.until).toBe(element)
    }
    const bare = resolveSticky({})
    if (bare !== false) {
      expect(bare.trigger).toBeUndefined()
      expect(bare.until).toBeUndefined()
    }
  })

  it('replaces toggleAttributes wholesale instead of key-merging a default into it', () => {
    const map = { 'data-x': { active: 'on' } }
    const resolved = resolveSticky({ toggleAttributes: map })
    if (resolved !== false) {
      expect(resolved.toggleAttributes).toEqual(map)
    }
  })

  it('defaults toggleAttributes to false when omitted', () => {
    const resolved = resolveSticky({})
    if (resolved !== false) {
      expect(resolved.toggleAttributes).toBe(false)
    }
  })

  it('nests a reveal false without disabling sticky itself', () => {
    const resolved = resolveSticky({ reveal: false })
    expect(resolved).not.toBe(false)
    if (resolved !== false) {
      expect(resolved.reveal).toBe(false)
    }
  })
})

describe('resolveHeightObserver', () => {
  it('fills defaults and honors partial overrides', () => {
    expect(resolveHeightObserver(undefined)).toEqual({ observe: true, cleanupOnDestroy: false })
    expect(resolveHeightObserver({ observe: false })).toEqual({
      observe: false,
      cleanupOnDestroy: false
    })
  })
})
