import { coalesceToFrame } from '@ts/utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeRaf } from '../support'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('coalesceToFrame', () => {
  it('collapses a same-tick burst of schedule() calls into one callback on the next frame', () => {
    const raf = fakeRaf()
    const fn = vi.fn()
    const coalesced = coalesceToFrame(fn)
    coalesced.schedule()
    coalesced.schedule()
    coalesced.schedule()
    expect(raf.pendingCount).toBe(1)
    raf.step()
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('re-arms after the frame fires — the next burst schedules again', () => {
    const raf = fakeRaf()
    const fn = vi.fn()
    const coalesced = coalesceToFrame(fn)
    coalesced.schedule()
    raf.step()
    coalesced.schedule()
    raf.step()
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('cancel drops the pending frame and allows a fresh schedule', () => {
    const raf = fakeRaf()
    const fn = vi.fn()
    const coalesced = coalesceToFrame(fn)
    coalesced.schedule()
    coalesced.cancel()
    expect(raf.pendingCount).toBe(0)
    raf.step()
    expect(fn).not.toHaveBeenCalled()
    coalesced.schedule()
    raf.step()
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
