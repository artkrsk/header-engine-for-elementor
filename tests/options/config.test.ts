import { defaultConfig } from '@ts/constants'
import { resolveConfig } from '@ts/options/config'
import { describe, expect, it } from 'vitest'

describe('resolveConfig', () => {
  it('fills every class, var and selector from the defaults when given nothing', () => {
    expect(resolveConfig()).toEqual(defaultConfig)
  })

  it('preserves an empty-string override verbatim — the state-class opt-out contract', () => {
    // '' means "do not write this class at all"; a helpful `|| default` fallback would break it.
    const resolved = resolveConfig({ classes: { sticking: '' } })
    expect(resolved.classes.sticking).toBe('')
  })

  it('leaves untouched keys at their defaults on a partial override', () => {
    const resolved = resolveConfig({ classes: { hidden: 'my-hidden' } })
    expect(resolved.classes.hidden).toBe('my-hidden')
    expect(resolved.classes.sticking).toBe(defaultConfig.classes.sticking)
    expect(resolved.vars.headerHeight).toBe(defaultConfig.vars.headerHeight)
  })

  it('never mutates the shared defaults', () => {
    const resolved = resolveConfig()
    resolved.classes.sticking = 'mutated'
    expect(defaultConfig.classes.sticking).toBe('arts-header_sticky')
  })
})
