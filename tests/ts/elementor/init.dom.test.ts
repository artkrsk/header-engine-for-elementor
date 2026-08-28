// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'

const flush = async (): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

type TGlobals = {
  artsHeaderForElementor?: unknown
  artsHeaderOptions?: unknown
  elementorFrontend?: unknown
}

const freshInit = async () => {
  vi.resetModules()
  const module = await import('@ts/elementor/init')
  return module.init
}

afterEach(() => {
  const w = window as TGlobals
  w.artsHeaderForElementor = undefined
  w.artsHeaderOptions = undefined
  w.elementorFrontend = undefined
})

describe('init', () => {
  it('boots the app on the frontend path and stores it on the window global', async () => {
    const init = await freshInit()
    init()
    await flush()
    expect(window.artsHeaderForElementor).toBeDefined()
  })

  it('defers the boot in the editor and attaches the container handler once edit mode resolves', async () => {
    const attachHandler = vi.fn()
    const w = window as TGlobals
    w.artsHeaderOptions = { isElementorEditor: true }
    w.elementorFrontend = {
      elementsHandler: { attachHandler },
      isEditMode: () => true
    }
    const init = await freshInit()
    init()
    await flush()
    expect(window.artsHeaderForElementor).toBeDefined()
    expect(window.artsHeaderForElementor?.artsHeader).toBeUndefined()
    expect(attachHandler).toHaveBeenCalledTimes(1)
    expect(attachHandler.mock.calls[0]?.[0]).toBe('container')
  })
})
