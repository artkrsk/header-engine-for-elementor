// @vitest-environment happy-dom
import { Resize } from '@ts/utils'
import { describe, expect, it, vi } from 'vitest'
import { fakeResizeObserver } from '../support'

describe('Resize', () => {
  it('observes every element with the border-box option', () => {
    // Border-box is what makes padding-driven sticky shrink fire the callback.
    const instances = fakeResizeObserver()
    const a = document.createElement('div')
    const b = document.createElement('div')
    new Resize({ elements: [a, b], callbackResize: () => {} })
    expect(instances).toHaveLength(1)
    expect(instances[0]?.observed).toEqual([
      { target: a, options: { box: 'border-box' } },
      { target: b, options: { box: 'border-box' } }
    ])
  })

  it('creates no observer without elements or without a callback to tell', () => {
    const instances = fakeResizeObserver()
    new Resize({ elements: [], callbackResize: () => {} })
    new Resize({ elements: [document.createElement('div')] })
    expect(instances).toHaveLength(0)
  })

  it('observes only real elements — a non-element target is skipped, not handed to the observer', () => {
    const instances = fakeResizeObserver()
    const el = document.createElement('div')
    const textNode = { nodeType: 3 } as unknown as HTMLElement
    new Resize({ elements: [textNode, el], callbackResize: () => {} })
    expect(instances[0]?.observed.map((record) => record.target)).toEqual([el])
  })

  it('skips construction entirely when ResizeObserver is not available', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    const instance = new Resize({
      elements: [document.createElement('div')],
      callbackResize: () => {}
    })
    expect(() => instance.destroy()).not.toThrow()
  })

  it('maps entries to their targets for the callback', () => {
    const instances = fakeResizeObserver()
    const el = document.createElement('div')
    const spy = vi.fn()
    new Resize({ elements: [el], callbackResize: spy })
    const entry = { target: el } as unknown as ResizeObserverEntry
    instances[0]?.callback([entry], {} as ResizeObserver)
    expect(spy).toHaveBeenCalledWith([el], [entry])
  })

  it('disconnects on destroy and tolerates a second destroy', () => {
    const instances = fakeResizeObserver()
    const instance = new Resize({
      elements: [document.createElement('div')],
      callbackResize: () => {}
    })
    instance.destroy()
    instance.destroy()
    expect(instances[0]?.disconnectCount).toBe(1)
  })
})
