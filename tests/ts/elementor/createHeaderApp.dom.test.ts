// @vitest-environment happy-dom
import { createHeaderApp } from '@ts/elementor/createHeaderApp'
import type { IHeaderApp } from '@ts/interfaces'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fakeMutationObserver,
  fakeRaf,
  fakeResizeObserver,
  makeHeaderFixture,
  setScroll,
  setScrollBounds
} from '../support'

const apps: IHeaderApp[] = []

beforeEach(() => {
  setScrollBounds(5000, 800)
  setScroll(0, 0)
  fakeMutationObserver()
  fakeResizeObserver()
})

afterEach(async () => {
  for (const app of apps) {
    await app.destroy(false)
  }
  apps.length = 0
  document.body.innerHTML = ''
  // destroy(false) keeps visual state by design — scrub the <html> writes between tests.
  document.documentElement.classList.remove('has-header-height')
  document.documentElement.style.removeProperty('--arts-header-height')
  document.documentElement.style.removeProperty('--arts-header-height-non-sticky')
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
    // The height observer stamps `has-header-height` on <html> synchronously during wiring.
    const wired = (): number =>
      document.documentElement.classList.contains('has-header-height') ? 1 : 0
    const app = await createHeaderApp({
      callbackBefore: () => {
        order.push(`before:${wired()}`)
      },
      callbackAfter: () => {
        order.push(`after:${wired()}`)
      }
    })
    apps.push(app)
    expect(order).toEqual(['before:0', 'after:1'])
  })

  it('boots one engine per wrapper — the primary accessor is the first in DOM order', async () => {
    makeHeaderFixture()
    makeHeaderFixture()
    const app = await createHeaderApp()
    apps.push(app)
    expect(app.instances).toHaveLength(2)
    expect(app.instances.every((h) => h.isInitialized)).toBe(true)
    expect(app.artsHeader).toBe(app.instances[0])
  })

  it('skips a wrapper missing its bar and boots the rest', async () => {
    const orphan = document.createElement('div')
    orphan.className = 'arts-header js-arts-header'
    document.body.appendChild(orphan)
    makeHeaderFixture()
    const app = await createHeaderApp()
    apps.push(app)
    expect(app.instances).toHaveLength(1)
    expect(app.instances[0]?.isInitialized).toBe(true)
  })

  it('destroys every instance through the aggregate destroy and empties the registry', async () => {
    makeHeaderFixture()
    makeHeaderFixture()
    const app = await createHeaderApp()
    apps.push(app)
    const booted = app.instances
    expect(booted).toHaveLength(2)
    await app.destroy(true)
    expect(booted.every((h) => !h.isInitialized)).toBe(true)
    // `instances` promises LIVE instances — a torn-down one is not one.
    expect(app.instances).toHaveLength(0)
  })

  it('destroys the live header through the app', async () => {
    makeHeaderFixture()
    const app = await createHeaderApp()
    apps.push(app)
    const primary = app.artsHeader
    await app.destroy(true)
    expect(primary?.isInitialized).toBe(false)
    expect(app.artsHeader).toBeUndefined()
  })

  it('drops a scan whose page was torn down mid-await', async () => {
    makeHeaderFixture()
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const app = await createHeaderApp({ autoInit: false, callbackBefore: () => gate })
    apps.push(app)
    const booting = app.init()
    await app.destroy(false)
    release()
    await booting
    // The teardown could not have seen instances the scan had not created yet, so the scan must
    // not create them behind it.
    expect(app.instances).toHaveLength(0)
  })

  it("propagates one instance's settled height vars to the other instances", async () => {
    const raf = fakeRaf()
    const ro = fakeResizeObserver()
    const primary = makeHeaderFixture()
    const secondary = makeHeaderFixture()
    // A real secondary (Markup.php emission): no height publishing of its own...
    secondary.container.setAttribute('data-arts-header-options', '{"heightObserver": false}')
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const app = await createHeaderApp()
    apps.push(app)
    // ...but its reveal offset chains to the PRIMARY's height var.
    secondary.container.style.setProperty('--arts-header-reveal-offset', '500px')
    // The primary's height corrects after boot; only its own publisher observes that.
    primary.bar.getBoundingClientRect = () => ({ height: 64 }) as DOMRect
    const primaryHeightRO = ro.filter((o) => o.observed.some((e) => e.target === primary.bar))[1]
    expect(primaryHeightRO).toBeDefined()
    primaryHeightRO?.callback([], {} as ResizeObserver)
    vi.advanceTimersByTime(600)
    vi.useRealTimers()
    const scrollTo = (y: number): void => {
      setScroll(0, y)
      window.dispatchEvent(new Event('scroll'))
      raf.step()
    }
    scrollTo(50)
    scrollTo(300)
    // The fan-out re-measured the secondary's chained 500px offset: it stays revealed while the
    // primary (offset 0) hides — the settled signal genuinely crossed instances.
    expect(primary.container.classList.contains('arts-header_scrolling-down')).toBe(true)
    expect(secondary.container.classList.contains('arts-header_scrolling-down')).toBe(false)
  })

  it('lands CONCURRENT editor upserts for different containers — no argument-swallowing dedup', async () => {
    ;(window as { elementorModules?: unknown }).elementorModules = {
      frontend: { handlers: { Base: { extend: (proto: unknown) => proto } } }
    }
    let proto: object | null = null
    ;(window as { elementorFrontend?: unknown }).elementorFrontend = {
      elementsHandler: {
        attachHandler: (_type: string, handler: unknown) => {
          proto = handler as object
        }
      }
    }
    const app = await createHeaderApp({ autoInit: false })
    apps.push(app)
    app.loadElementorEditorHandler()
    const settings: Record<string, unknown> = {
      arts_header_enabled: 'yes',
      arts_header_on_scroll: 'sticky'
    }
    const makeEditorHandler = (id: string) => {
      const el = document.createElement('div')
      document.body.appendChild(el)
      return Object.assign(Object.create(proto as object) as { onInit(): Promise<void> }, {
        el,
        $element: { get: () => el },
        isLoading: false,
        getElementSettings: (key: string) => settings[key],
        getID: () => id
      })
    }
    const h1 = makeEditorHandler('one')
    const h2 = makeEditorHandler('two')
    // Both handlers boot back-to-back, un-awaited — on editor load Elementor defers each
    // element's boot into its own task. onInit is fire-and-forget there too, so wait on the outcome.
    h1.onInit()
    h2.onInit()
    await vi.waitFor(() => expect(app.instances).toHaveLength(2))
    ;(window as { elementorModules?: unknown }).elementorModules = undefined
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
