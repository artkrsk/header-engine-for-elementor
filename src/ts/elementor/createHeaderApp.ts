import { defaultConfig } from '../constants'
import { createHeader } from '../core/createHeader'
import type { IHeader, IHeaderApp, IHeaderAppArgs } from '../interfaces'
import { logger } from '../utils'
import { attachContainerHandler } from './containerHandler'

/** De-duplicate concurrent calls onto the same in-flight promise; later arguments are ignored. */
const singleFlight = <A extends unknown[]>(
  run: (...callArgs: A) => Promise<void>
): ((...callArgs: A) => Promise<void>) => {
  let pending: Promise<void> | null = null
  return (...callArgs) => {
    pending ??= run(...callArgs).finally(() => {
      pending = null
    })
    return pending
  }
}

/** DOM-order sort for registry containers — the first wrapper is the page's PRIMARY header. */
const byDocumentOrder = (a: HTMLElement, b: HTMLElement): number =>
  a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1

/**
 * The app lifecycle around the page's header instances — one engine per `.js-arts-header`
 * wrapper, keyed by container. Aggregate `init()`/`destroy()` keep the single-header consumer
 * contract unchanged — the shape an AJAX page-transition cycle calls; the editor upserts per
 * container. Concurrent
 * aggregate calls are de-duplicated onto the same in-flight promise — a second caller genuinely
 * awaits the first run instead of being told "done" before it is.
 */
export async function createHeaderApp(args: IHeaderAppArgs = {}): Promise<IHeaderApp> {
  const registry = new Map<HTMLElement, IHeader>()
  let editorHandlerAttached = false

  const upsert = (container: HTMLElement, bar: HTMLElement | null): void => {
    registry.get(container)?.destroy()
    registry.delete(container)
    if (!bar) {
      logger.error('barElement is required')
      return
    }
    const header = createHeader(container, bar, {
      // One instance's settled height vars re-resolve the OTHER instances' chained pin/reveal
      // offsets (a secondary referencing the primary's vars) — the writer signals here instead
      // of every instance observing <html> style mutations.
      onHeightVarsSettled: () => {
        for (const [other, instance] of registry) {
          if (other !== container) {
            instance.refresh()
          }
        }
      }
    })
    header.init()
    registry.set(container, header)
  }

  const scan = singleFlight(async () => {
    try {
      await args.callbackBefore?.()

      // Prune entries whose containers left the DOM (AJAX page swaps), then one engine per
      // wrapper. A re-scan replaces existing instances (re-discover semantics).
      for (const container of registry.keys()) {
        if (!container.isConnected) {
          registry.get(container)?.destroy()
          registry.delete(container)
        }
      }
      // No wrappers is a legitimate state, not an error: any page without an Elementor header
      // (every Canvas template, for one) matches nothing and the loop simply no-ops.
      const wrappers = document.querySelectorAll<HTMLElement>(defaultConfig.selectors.container)
      for (const wrapper of wrappers) {
        upsert(wrapper, wrapper.querySelector<HTMLElement>(defaultConfig.selectors.bar))
      }

      await args.callbackAfter?.()
    } catch (error) {
      logger.error('Error during arts header initialization:', error)
      throw error
    }
  })

  // Editor upserts SERIALIZE but each call keeps its own container — Elementor boots one handler
  // per header container (each in its own deferred task, so calls overlap in flight), and a
  // single-flight dedup here would silently drop every container after the first (its arguments
  // are ignored by design).
  let editorChain: Promise<void> = Promise.resolve()
  const load = (
    elements: { container?: HTMLElement | null; bar?: HTMLElement | null } = {}
  ): Promise<void> => {
    const container = elements.container
    if (!container) {
      return scan()
    }
    const run = editorChain.then(async () => {
      try {
        await args.callbackBefore?.()
        upsert(
          container,
          elements.bar ?? container.querySelector<HTMLElement>(defaultConfig.selectors.bar)
        )
        await args.callbackAfter?.()
      } catch (error) {
        logger.error('Error during arts header initialization:', error)
        throw error
      }
    })
    editorChain = run.catch(() => {})
    return run
  }

  const destroyAll = singleFlight((revert: boolean = false) =>
    Promise.resolve().then(() => {
      for (const header of registry.values()) {
        header.destroy(revert)
      }
    })
  )

  const destroyOne = async (container?: HTMLElement | null, revert = false): Promise<void> => {
    if (!container) {
      await destroyAll(revert)
      return
    }
    registry.get(container)?.destroy(revert)
    registry.delete(container)
  }

  const app: IHeaderApp = {
    async init() {
      await load()
      return true
    },
    async destroy(revert = false) {
      await destroyAll(revert)
      return true
    },
    loadElementorEditorHandler() {
      if (editorHandlerAttached) {
        return
      }
      attachContainerHandler(load, destroyOne)
      editorHandlerAttached = true
    },
    get artsHeader() {
      return this.instances[0]
    },
    get instances() {
      return [...registry.keys()].sort(byDocumentOrder).map((key) => registry.get(key) as IHeader)
    }
  }

  if (args.autoInit ?? true) {
    await app.init()
  }
  return app
}
