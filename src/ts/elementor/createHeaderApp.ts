import { defaultConfig } from '../constants'
import { createHeader } from '../core/createHeader'
import type { IHeader, IHeaderApp, IHeaderAppArgs } from '../interfaces'
import { logger } from '../utils'
import { attachContainerHandler } from './containerHandler'

/**
 * The app lifecycle around one global header instance. Concurrent `init()`/`destroy()` calls are
 * de-duplicated onto the same in-flight promise — a second caller genuinely awaits the first run
 * instead of being told "done" before it is.
 */
export async function createHeaderApp(args: IHeaderAppArgs = {}): Promise<IHeaderApp> {
  let header: IHeader | undefined
  let editorHandlerAttached = false
  let pendingLoad: Promise<void> | null = null
  let pendingDestroy: Promise<void> | null = null

  const load = (
    elements: { container?: HTMLElement | null; bar?: HTMLElement | null } = {}
  ): Promise<void> => {
    if (pendingLoad) {
      return pendingLoad
    }
    pendingLoad = (async () => {
      try {
        await args.callbackBefore?.()

        // A re-load (editor panel change) replaces the previous instance.
        header?.destroy()

        const containerElement =
          elements.container ??
          document.querySelector<HTMLElement>(defaultConfig.selectors.container)
        const barElement =
          elements.bar ??
          containerElement?.querySelector<HTMLElement>(defaultConfig.selectors.bar) ??
          null

        if (containerElement && barElement) {
          header = createHeader(containerElement, barElement)
          header.init()
        }

        await args.callbackAfter?.()
      } catch (error) {
        logger.error('Error during arts header initialization:', error)
        throw error
      }
    })()
    return pendingLoad.finally(() => {
      pendingLoad = null
    })
  }

  const destroyHeader = (revert = false): Promise<void> => {
    if (pendingDestroy) {
      return pendingDestroy
    }
    pendingDestroy = Promise.resolve().then(() => {
      header?.destroy(revert)
    })
    return pendingDestroy.finally(() => {
      pendingDestroy = null
    })
  }

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
