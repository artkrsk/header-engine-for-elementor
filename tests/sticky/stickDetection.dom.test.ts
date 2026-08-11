// @vitest-environment happy-dom
import { SENTINEL_CLASS } from '@ts/constants'
import { createStickDetection } from '@ts/sticky/stickDetection'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeIntersectionObserver, makeHeaderFixture } from '../support'

afterEach(() => {
  document.body.innerHTML = ''
})

const entry = (isIntersecting: boolean, top: number) =>
  ({ isIntersecting, boundingClientRect: { top } }) as IntersectionObserverEntry

describe('createStickDetection', () => {
  it('injects the sentinel as a sibling BEFORE the wrapper, not inside it', () => {
    fakeIntersectionObserver()
    const { container } = makeHeaderFixture()
    createStickDetection({ container, trigger: undefined, onStuckChange: () => {} })
    const sentinel = container.previousElementSibling
    expect(sentinel?.classList.contains(SENTINEL_CLASS)).toBe(true)
    expect(container.querySelector(`.${SENTINEL_CLASS}`)).toBeNull()
  })

  it('lets a custom trigger replace the sentinel entirely', () => {
    const instances = fakeIntersectionObserver()
    const { container } = makeHeaderFixture()
    const trigger = document.createElement('span')
    document.body.appendChild(trigger)
    const detection = createStickDetection({ container, trigger, onStuckChange: () => {} })
    detection.rearm(0)
    expect(document.querySelector(`.${SENTINEL_CLASS}`)).toBeNull()
    expect(instances[0]?.observed[0]?.target).toBe(trigger)
  })

  it('shrinks the root top edge to the sticky line', () => {
    const instances = fakeIntersectionObserver()
    const { container } = makeHeaderFixture()
    const detection = createStickDetection({
      container,
      trigger: undefined,
      onStuckChange: () => {}
    })
    detection.rearm(32)
    expect(instances[0]?.init).toEqual({ rootMargin: '-32px 0px 0px 0px', threshold: [0] })
  })

  it('fires only on genuine transitions and reads the LAST entry of a batch', () => {
    const instances = fakeIntersectionObserver()
    const { container } = makeHeaderFixture()
    const spy = vi.fn()
    const detection = createStickDetection({ container, trigger: undefined, onStuckChange: spy })
    detection.rearm(0)
    const observer = {} as IntersectionObserver
    // Stale not-intersecting first, current intersecting last — the batch must resolve un-stuck.
    instances[0]?.callback([entry(false, -10), entry(true, 5)], observer)
    expect(spy).not.toHaveBeenCalled()
    instances[0]?.callback([entry(false, -10)], observer)
    expect(spy).toHaveBeenCalledWith(true, 10)
    instances[0]?.callback([entry(false, -12)], observer)
    expect(spy).toHaveBeenCalledTimes(1)
    instances[0]?.callback([], observer)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('re-arming disconnects the previous observer', () => {
    const instances = fakeIntersectionObserver()
    const { container } = makeHeaderFixture()
    const detection = createStickDetection({
      container,
      trigger: undefined,
      onStuckChange: () => {}
    })
    detection.rearm(0)
    detection.rearm(32)
    expect(instances[0]?.disconnectCount).toBe(1)
    expect(instances).toHaveLength(2)
  })

  it('destroy disconnects and removes the injected sentinel', () => {
    const instances = fakeIntersectionObserver()
    const { container } = makeHeaderFixture()
    const detection = createStickDetection({
      container,
      trigger: undefined,
      onStuckChange: () => {}
    })
    detection.rearm(0)
    detection.destroy()
    expect(instances[0]?.disconnectCount).toBe(1)
    expect(document.querySelector(`.${SENTINEL_CLASS}`)).toBeNull()
  })
})
