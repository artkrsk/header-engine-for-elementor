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

/** Explicit editor-passed elements win; otherwise query the default selectors. */
const resolveElements = (elements: {
  container?: HTMLElement | null
  bar?: HTMLElement | null
}): { container: HTMLElement | null; bar: HTMLElement | null } => {
  const container =
    elements.container ?? document.querySelector<HTMLElement>(defaultConfig.selectors.container)
  const bar =
    elements.bar ?? container?.querySelector<HTMLElement>(defaultConfig.selectors.bar) ?? null
  return { container, bar }
}

/**
 * The app lifecycle around one global header instance. Concurrent `init()`/`destroy()` calls are
 * de-duplicated onto the same in-flight promise — a second caller genuinely awaits the first run
 * instead of being told "done" before it is.
 */
export async function createHeaderApp(args: IHeaderAppArgs = {}): Promise<IHeaderApp> {
  let header: IHeader | undefined
  let editorHandlerAttached = false

  const load = singleFlight(
    async (elements: { container?: HTMLElement | null; bar?: HTMLElement | null } = {}) => {
      try {
        await args.callbackBefore?.()

        // A re-load (editor panel change) replaces the previous instance.
        header?.destroy()

        const { container, bar } = resolveElements(elements)
        if (container && bar) {
          header = createHeader(container, bar)
          header.init()
        }

        await args.callbackAfter?.()
      } catch (error) {
        logger.error('Error during arts header initialization:', error)
        throw error
      }
    }
  )

  const destroyHeader = singleFlight((revert: boolean = false) =>
    Promise.resolve().then(() => {
      header?.destroy(revert)
    })
  )

  const app: IHeaderApp = {
    async init() {
      await load()
      return true
    },
    async destroy(revert = false) {
      await destroyHeader(revert)
      return true
    },
    loadElementorEditorHandler() {
      if (editorHandlerAttached) {
        return
      }
      attachContainerHandler(load, destroyHeader)
      editorHandlerAttached = true
    },
    get artsHeader() {
      return header
    }
  }

  if (args.autoInit ?? true) {
    await app.init()
  }
  return app
}
