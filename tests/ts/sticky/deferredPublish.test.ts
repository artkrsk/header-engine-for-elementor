import { shouldPublishDeferredStick } from '@ts/sticky/deferredPublish'
import { describe, expect, it } from 'vitest'

describe('shouldPublishDeferredStick', () => {
  it('publishes once the accumulator reaches a full bar height — departure completed off-screen', () => {
    expect(shouldPublishDeferredStick(80, 80, 80)).toBe(true)
    expect(shouldPublishDeferredStick(79.5, 80, 80)).toBe(false)
  })

  it('publishes when the accumulator lags the scroll travelled by more than the tolerance — visibly held', () => {
    expect(shouldPublishDeferredStick(10, 80, 15)).toBe(true)
  })

  it('keeps deferring while the accumulator tracks scroll within the tolerance', () => {
    expect(shouldPublishDeferredStick(10, 80, 13)).toBe(false)
    expect(shouldPublishDeferredStick(10, 80, 10)).toBe(false)
  })

  it('treats exactly tolerance-behind as still tracking', () => {
    // scrubOffset < since - tolerance is strict: 10 < 14 - 4 is false.
    expect(shouldPublishDeferredStick(10, 80, 14)).toBe(false)
  })
})
