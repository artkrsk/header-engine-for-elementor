// @vitest-environment happy-dom
import { SENTINEL_CLASS } from '@ts/constants'
import { createUntilRelease } from '@ts/sticky/untilRelease'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeIntersectionObserver, makeHeaderFixture, setScroll } from '../support'

afterEach(() => {
  document.body.innerHTML = ''
})

const entry = (isIntersecting: boolean, top: number) =>
  ({ isIntersecting, boundingClientRect: { top } }) as IntersectionObserverEntry

const RELEASE_VAR = '--arts-header-release-top'

const fixture = () => {
  const { container } = makeHeaderFixture()
  const boundary = document.createElement('section')
  document.body.appendChild(boundary)
  return { container, boundary }
}

describe('createUntilRelease', () => {
  it('observes a sentinel injected before the boundary, never the (possibly tall) boundary itself', () => {
    const instances = fakeIntersectionObserver()
    const { container, boundary } = fixture()
    const release = createUntilRelease({
      container,
      until: boundary,
      releaseTopVar: RELEASE_VAR,
      onReleaseChange: () => {}
    })
    release.rearm(0, 80)
    const sentinel = boundary.previousElementSibling
    expect(sentinel?.classList.contains(SENTINEL_CLASS)).toBe(true)
    expect(instances[0]?.observed[0]?.target).toBe(sentinel)
    expect(instances[0]?.init).toEqual({ rootMargin: '-80px 0px 0px 0px', threshold: [0] })
  })

  it('writes the anchor var BEFORE announcing the release, and clears it on un-release', () => {
    const instances = fakeIntersectionObserver()
    const { container, boundary } = fixture()
    setScroll(0, 500)
    const seenAtCallback: (string | undefined)[] = []
    const release = createUntilRelease({
      container,
      until: boundary,
      releaseTopVar: RELEASE_VAR,
      onReleaseChange: () => {
        seenAtCallback.push(container.style.getPropertyValue(RELEASE_VAR))
      }
    })
    release.rearm(32, 80)
    const observer = {} as IntersectionObserver
    instances[0]?.callback([entry(false, 50)], observer)
    // round(scrollY + stickyTop) = 532 — already applied when the callback observed the state.
    expect(seenAtCallback[0]).toBe('532px')
    instances[0]?.callback([entry(true, 200)], observer)
    expect(container.style.getPropertyValue(RELEASE_VAR)).toBe('')
  })

  it('dedups repeat deliveries of the same state', () => {
    const instances = fakeIntersectionObserver()
    const { container, boundary } = fixture()
    const spy = vi.fn()
    const release = createUntilRelease({
      container,
      until: boundary,
      releaseTopVar: RELEASE_VAR,
      onReleaseChange: spy
    })
    release.rearm(0, 80)
    const observer = {} as IntersectionObserver
    instances[0]?.callback([entry(false, 10)], observer)
    instances[0]?.callback([entry(false, 5)], observer)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('re-arms against the CURRENT bar height — the bar can resize without the pin line moving', () => {
    const instances = fakeIntersectionObserver()
    const { container, boundary } = fixture()
    const release = createUntilRelease({
      container,
      until: boundary,
      releaseTopVar: RELEASE_VAR,
      onReleaseChange: () => {}
    })
    release.rearm(0, 80)
    release.rearm(0, 140)
    expect(instances[0]?.disconnectCount).toBe(1)
    expect(instances[1]?.init).toEqual({ rootMargin: '-140px 0px 0px 0px', threshold: [0] })
  })

  it('skips the var writes entirely when the config var is the empty-string opt-out', () => {
    const instances = fakeIntersectionObserver()
    const { container, boundary } = fixture()
    const release = createUntilRelease({
      container,
      until: boundary,
      releaseTopVar: '',
      onReleaseChange: () => {}
    })
    release.rearm(0, 80)
    instances[0]?.callback([entry(false, 10)], {} as IntersectionObserver)
    expect(container.getAttribute('style') ?? '').toBe('')
  })

  it('destroy disconnects, removes the sentinel, and clears the anchor var', () => {
    const instances = fakeIntersectionObserver()
    const { container, boundary } = fixture()
    const release = createUntilRelease({
      container,
      until: boundary,
      releaseTopVar: RELEASE_VAR,
      onReleaseChange: () => {}
    })
    release.rearm(0, 80)
    instances[0]?.callback([entry(false, 10)], {} as IntersectionObserver)
    release.destroy()
    expect(instances[0]?.disconnectCount).toBe(1)
    expect(document.querySelector(`.${SENTINEL_CLASS}`)).toBeNull()
    expect(container.style.getPropertyValue(RELEASE_VAR)).toBe('')
  })
})
