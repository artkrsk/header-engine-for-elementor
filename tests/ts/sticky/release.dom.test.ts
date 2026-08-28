// @vitest-environment happy-dom
import { createRelease, resolveReleased } from '@ts/sticky/release'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setScroll } from '../support'

beforeEach(() => {
  // setScroll defines plain window properties — unstubGlobals does not revert them across tests.
  setScroll(0, 0)
})

afterEach(() => {
  document.body.innerHTML = ''
})

const makeRig = (releaseTopVar = '--arts-header-release-top') => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const boundary = document.createElement('section')
  boundary.className = 'until-boundary'
  boundary.getBoundingClientRect = () => ({ top: 1000, bottom: 2500 }) as DOMRect
  document.body.appendChild(boundary)
  const onReleaseChange = vi.fn()
  const release = createRelease({ container, until: boundary, releaseTopVar, onReleaseChange })
  return { container, boundary, release, onReleaseChange }
}

describe('resolveReleased', () => {
  it('releases when the header bottom edge (pin + bar height) reaches the boundary top', () => {
    expect(resolveReleased(919, 0, 80, 1000)).toBe(false)
    expect(resolveReleased(920, 0, 80, 1000)).toBe(true)
    expect(resolveReleased(888, 32, 80, 1000)).toBe(true)
  })
})

describe('createRelease', () => {
  it('writes the anchor var BEFORE announcing the release, and clears it on un-release', () => {
    setScroll(0, 0)
    const { container, release, onReleaseChange } = makeRig()
    release.measure(0, 80)
    onReleaseChange.mockImplementation(() => {
      // The anchor must already be resolvable when consumers observe the state change.
      expect(container.style.getPropertyValue('--arts-header-release-top')).not.toBe('')
    })
    setScroll(0, 940)
    release.evaluate(940)
    expect(onReleaseChange).toHaveBeenCalledWith(true)
    expect(container.style.getPropertyValue('--arts-header-release-top')).toBe('940px')
    onReleaseChange.mockImplementation(() => {})
    release.evaluate(500)
    expect(onReleaseChange).toHaveBeenLastCalledWith(false)
    expect(container.style.getPropertyValue('--arts-header-release-top')).toBe('')
  })

  it('dedups repeat evaluations of the same state', () => {
    const { release, onReleaseChange } = makeRig()
    release.measure(0, 80)
    release.evaluate(950)
    release.evaluate(980)
    expect(onReleaseChange).toHaveBeenCalledTimes(1)
  })

  it('re-measures against the CURRENT bar height — the bar can resize without the pin moving', () => {
    const { release, onReleaseChange } = makeRig()
    release.measure(0, 80)
    release.evaluate(900)
    expect(onReleaseChange).not.toHaveBeenCalled()
    release.measure(0, 140)
    release.evaluate(900)
    expect(onReleaseChange).toHaveBeenCalledWith(true)
  })

  it('skips the var writes entirely when the config var is the empty-string opt-out', () => {
    const { container, release } = makeRig('')
    release.measure(0, 80)
    release.evaluate(950)
    expect(container.getAttribute('style') ?? '').toBe('')
  })

  it('does nothing without a boundary, and destroy clears the anchor var', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const onReleaseChange = vi.fn()
    const bare = createRelease({
      container,
      until: undefined,
      releaseTopVar: '--arts-header-release-top',
      onReleaseChange
    })
    bare.measure(0, 80)
    bare.evaluate(99999)
    expect(onReleaseChange).not.toHaveBeenCalled()

    const rig = makeRig()
    rig.release.measure(0, 80)
    rig.release.evaluate(950)
    rig.release.destroy()
    expect(rig.container.style.getPropertyValue('--arts-header-release-top')).toBe('')
  })
})
