import { vi } from 'vitest'

/**
 * Shared mechanical fakes for the test suites — pieces that would otherwise be hand-copied across
 * files and carry no per-test meaning. Everything here is a FACTORY that builds fresh objects per
 * call so no state leaks across tests. The make/fake verbs are the test-side convention on purpose;
 * `create` is reserved for engine factories. The filename deliberately does not end in `.test.ts`,
 * so Vitest never collects it as a suite; coverage never sees it since it only instruments src/ts.
 */

/** Mock the window scroll offset (happy-dom's is read-only). */
export const setScroll = (x: number, y: number): void => {
  Object.defineProperty(window, 'scrollX', { value: x, configurable: true })
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
}

interface IObserverRecord<C> {
  callback: C
  init: unknown
  observed: { target: Element; options: unknown }[]
  disconnectCount: number
}

const makeObserverStub = <C>() => {
  const instances: IObserverRecord<C>[] = []
  class Stub {
    private record: IObserverRecord<C>

    constructor(callback: C, init?: unknown) {
      this.record = { callback, init, observed: [], disconnectCount: 0 }
      instances.push(this.record)
    }

    observe(target: Element, options?: unknown): void {
      this.record.observed.push({ target, options })
    }

    unobserve(): void {}

    disconnect(): void {
      this.record.disconnectCount++
    }

    takeRecords(): [] {
      return []
    }
  }
  return { instances, Stub }
}

/** Stub the global ResizeObserver with a constructor that captures its callback and bookkeeping.
    Drive records synchronously via `instances[i].callback(entries, observer)`. Relies on the
    config's `unstubGlobals: true` to restore the real constructor between tests. */
export const fakeResizeObserver = () => {
  const { instances, Stub } = makeObserverStub<ResizeObserverCallback>()
  vi.stubGlobal('ResizeObserver', Stub)
  return instances
}

/** Same capture-callback stub for IntersectionObserver. */
export const fakeIntersectionObserver = () => {
  const { instances, Stub } = makeObserverStub<IntersectionObserverCallback>()
  vi.stubGlobal('IntersectionObserver', Stub)
  return instances
}

/** Same capture-callback stub for MutationObserver (no cursor-follower precedent — zones only). */
export const fakeMutationObserver = () => {
  const { instances, Stub } = makeObserverStub<MutationCallback>()
  vi.stubGlobal('MutationObserver', Stub)
  return instances
}

/** Hand-stepped requestAnimationFrame: `step()` flushes every pending callback exactly once. */
export const fakeRaf = () => {
  let nextId = 1
  const pending = new Map<number, FrameRequestCallback>()
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
    const id = nextId++
    pending.set(id, cb)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number): void => {
    pending.delete(id)
  })
  return {
    step(now = 0) {
      const callbacks = [...pending.values()]
      pending.clear()
      for (const cb of callbacks) {
        cb(now)
      }
    },
    get pendingCount() {
      return pending.size
    }
  }
}

/**
 * A minimal container+bar pair matching the engine's expected markup, attached to the body. Every
 * rect is 0×0 in happy-dom, so the bar's measured height is stubbed to a real value.
 */
export const makeHeaderFixture = (barHeight = 80) => {
  const container = document.createElement('div')
  container.className = 'arts-header js-arts-header'
  const bar = document.createElement('div')
  bar.className = 'arts-header__bar js-arts-header__bar arts-header__bar_sticky'
  bar.getBoundingClientRect = () => ({ height: barHeight }) as DOMRect
  container.appendChild(bar)
  document.body.appendChild(container)
  return { container, bar }
}

/** Control the cached document bounds (happy-dom reports zero scrollHeight). */
export const setScrollBounds = (scrollHeight: number, innerHeight: number): void => {
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    value: scrollHeight,
    configurable: true
  })
  Object.defineProperty(window, 'innerHeight', { value: innerHeight, configurable: true })
}
