// @vitest-environment happy-dom
import { debounce } from '@ts/utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('collapses a burst into one trailing call with the last arguments', () => {
    const spy = vi.fn()
    const run = debounce(spy, 100)
    run('first')
    run('second')
    run('third')
    vi.advanceTimersByTime(100)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('third')
  })

  it('resets the pending timer on every call so rapid re-calls never fire early', () => {
    const spy = vi.fn()
    const run = debounce(spy, 100)
    run()
    vi.advanceTimersByTime(60)
    run()
    vi.advanceTimersByTime(60)
    expect(spy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(40)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('cancel() drops the pending trailing call', () => {
    const spy = vi.fn()
    const run = debounce(spy, 100)
    run()
    run.cancel()
    vi.advanceTimersByTime(200)
    expect(spy).not.toHaveBeenCalled()
  })
})
