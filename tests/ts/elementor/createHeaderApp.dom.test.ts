// @vitest-environment happy-dom
import { createHeaderApp } from '@ts/elementor/createHeaderApp'
import type { IHeaderApp } from '@ts/interfaces'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fakeIntersectionObserver,
  fakeMutationObserver,
  fakeResizeObserver,
  makeHeaderFixture,
  setScroll,
  setScrollBounds
} from '../support'

const apps: IHeaderApp[] = []

beforeEach(() => {
  setScrollBounds(5000, 800)
  setScroll(0, 0)
  fakeIntersectionObserver()
  fakeMutationObserver()
  fakeResizeObserver()
})

afterEach(async () => {
  for (const app of apps) {
    await app.destroy(false)
  }
  apps.length = 0
  document.body.innerHTML = ''
  ;(window as { elementorFrontend?: unknown }).elementorFrontend = undefined
})

describe('createHeaderApp', () => {
  it('discovers the header by its selectors and boots it on autoInit', async () => {
    makeHeaderFixture()
    const app = await createHeaderApp()
    apps.push(app)
    expect(app.artsHeader?.isInitialized).toBe(true)
  })

  it('skips the boot when autoInit is false — the editor path wires later', async () => {
    makeHeaderFixture()
    const app = await createHeaderApp({ autoInit: false })
    apps.push(app)
    expect(app.artsHeader).toBeUndefined()
  })

  it('de-duplicates concurrent init() calls onto the same in-flight run', async () => {
    makeHeaderFixture()
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const before = vi.fn(() => gate)
    const app = await createHeaderApp({ autoInit: false, callbackBefore: before })
    apps.push(app)
    const first = app.init()
    const second = app.init()
    let secondDone = false
    void second.then(() => {
      secondDone = true
    })
    await Promise.resolve()
    // The second caller genuinely waits for the first run — it is not told "done" early.
    expect(secondDone).toBe(false)
    release()
    await first
    await second
    expect(before).toHaveBeenCalledTimes(1)
    expect(app.artsHeader?.isInitialized).toBe(true)
  })

  it('replaces the previous header instance on a re-load', async () => {
    makeHeaderFixture()
    const app = await createHeaderApp()
    apps.push(app)
    const firstHeader = app.artsHeader
    await app.init()
    expect(app.artsHeader).not.toBe(firstHeader)
    expect(firstHeader?.isInitialized).toBe(false)
    expect(app.artsHeader?.isInitialized).toBe(true)
  })

  it('runs callbackBefore before the wiring and callbackAfter after it', async () => {
    makeHeaderFixture()
    const order: string[] = []
    const app = await createHeaderApp({
      callbackBefore: () => {
        order.push(`before:${document.querySelector('.arts-header__sentinel') ? 1 : 0}`)
      },
      callbackAfter: () => {
        order.push(`after:${document.querySelector('.arts-header__sentinel') ? 1 : 0}`)
      }
    })
    apps.push(app)
    expect(order).toEqual(['before:0', 'after:1'])
  })

  it('destroys the live header through the app', async () => {
    makeHeaderFixture()
    const app = await createHeaderApp()
    apps.push(app)
    await app.destroy(true)
    expect(app.artsHeader?.isInitialized).toBe(false)
  })

  it('attaches the editor container handler exactly once', async () => {
    const attachHandler = vi.fn()
    ;(window as { elementorFrontend?: unknown }).elementorFrontend = {
      elementsHandler: { attachHandler }
    }
    const app = await createHeaderApp({ autoInit: false })
    apps.push(app)
    app.loadElementorEditorHandler()
    app.loadElementorEditorHandler()
    expect(attachHandler).toHaveBeenCalledTimes(1)
    expect(attachHandler.mock.calls[0]?.[0]).toBe('container')
  })
})
