// @vitest-environment happy-dom
import { createValueHostInvalidation } from '@ts/core/createValueHostInvalidation'
import { afterEach, describe, expect, it, vi } from 'vitest'

const key = '--arts-header-values-revision'

afterEach(() => {
  document.body.innerHTML = ''
})

function fixture() {
  const host = document.createElement('div')
  host.className = 'js-arts-header-values'
  const wrapper = document.createElement('div')
  host.append(wrapper)
  document.body.append(host)
  return { host, wrapper }
}

describe('value host viewport invalidation', () => {
  it('coalesces resizing without measuring layout and drops queued work on silent teardown', () => {
    const frames = new Map<number, FrameRequestCallback>()
    let id = 0
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++id, callback)
      return id
    })
    vi.stubGlobal('cancelAnimationFrame', (frame: number) => frames.delete(frame))
    const { host, wrapper } = fixture()
    const rect = vi.spyOn(host, 'getBoundingClientRect')
    const values = createValueHostInvalidation(wrapper)
    window.dispatchEvent(new Event('resize'))
    window.dispatchEvent(new Event('resize'))
    expect(frames.size).toBe(1)
    for (const [key, callback] of frames) {
      frames.delete(key)
      callback(0)
    }
    expect(host.style.getPropertyValue(key)).toBe('1')
    expect(rect).not.toHaveBeenCalled()
    window.dispatchEvent(new Event('resize'))
    values.destroy(false)
    expect(frames.size).toBe(0)
    expect(host.style.getPropertyValue(key)).toBe('1')
    window.dispatchEvent(new Event('resize'))
    expect(frames.size).toBe(0)
  })

  it('restores a preexisting inline value on revert and keeps instances independent', () => {
    const first = fixture()
    const second = fixture()
    first.host.style.setProperty(key, 'original', 'important')
    const a = createValueHostInvalidation(first.wrapper)
    const b = createValueHostInvalidation(second.wrapper)
    a.refresh()
    expect(second.host.style.getPropertyValue(key)).toBe('')
    a.destroy(true)
    b.destroy(true)
    expect(first.host.style.getPropertyValue(key)).toBe('original')
    expect(first.host.style.getPropertyPriority(key)).toBe('important')
  })

  it('leaves legacy markup untouched', () => {
    const wrapper = document.createElement('div')
    document.body.append(wrapper)
    const values = createValueHostInvalidation(wrapper)
    values.refresh()
    values.destroy(true)
    expect(document.body.getAttribute('style')).toBeNull()
    expect(wrapper.getAttribute('style')).toBeNull()
  })

  it('invalidates an adopted host even when the previous instance left revision one', () => {
    const { host, wrapper } = fixture()
    host.style.setProperty(key, '1')
    const values = createValueHostInvalidation(wrapper)
    values.refresh()
    expect(host.style.getPropertyValue(key)).toBe('0')
    values.destroy(true)
    expect(host.style.getPropertyValue(key)).toBe('1')
  })
})
