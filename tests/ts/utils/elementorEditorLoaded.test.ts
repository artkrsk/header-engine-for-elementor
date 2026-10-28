// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'

/** The module caches its init promise at module scope, so every test imports a fresh copy. */
const freshImport = async () => {
  vi.resetModules()
  const module = await import('@ts/utils/elementorEditorLoaded')
  return module.elementorEditorLoaded
}

/** global.d.ts types the real ElementorFrontend; tests install minimal plain-object stands-in. */
const setElementorFrontend = (value: unknown): void => {
  ;(window as { elementorFrontend?: unknown }).elementorFrontend = value
}

afterEach(() => {
  setElementorFrontend(undefined)
})

describe('elementorEditorLoaded', () => {
  it('resolves the edit-mode flag immediately when the elements handler already exists', async () => {
    const elementorEditorLoaded = await freshImport()
    setElementorFrontend({ elementsHandler: {}, isEditMode: () => true })
    await expect(elementorEditorLoaded()).resolves.toBe(true)
  })

  it('resolves false when Elementor is present but cannot report an edit mode', async () => {
    const elementorEditorLoaded = await freshImport()
    setElementorFrontend({ elementsHandler: {} })
    await expect(elementorEditorLoaded()).resolves.toBe(false)
  })

  it('waits for elementor/frontend/init and resolves from it', async () => {
    const elementorEditorLoaded = await freshImport()
    const pending = elementorEditorLoaded()
    setElementorFrontend({ elementsHandler: {}, isEditMode: () => true })
    window.dispatchEvent(new Event('elementor/frontend/init'))
    await expect(pending).resolves.toBe(true)
  })

  it('resolves false outside a browser instead of touching window', async () => {
    const elementorEditorLoaded = await freshImport()
    vi.stubGlobal('window', undefined)
    try {
      await expect(elementorEditorLoaded()).resolves.toBe(false)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('shares one init listener between callers that arrive before the event', async () => {
    const elementorEditorLoaded = await freshImport()
    const addListener = vi.spyOn(window, 'addEventListener')
    const first = elementorEditorLoaded()
    const second = elementorEditorLoaded()
    setElementorFrontend({ elementsHandler: {}, isEditMode: () => true })
    window.dispatchEvent(new Event('elementor/frontend/init'))
    await expect(Promise.all([first, second])).resolves.toEqual([true, true])
    const initListeners = addListener.mock.calls.filter(
      ([type]) => type === 'elementor/frontend/init'
    )
    expect(initListeners).toHaveLength(1)
  })

  it('resolves false when the init event fires without an elements handler', async () => {
    const elementorEditorLoaded = await freshImport()
    const pending = elementorEditorLoaded()
    window.dispatchEvent(new Event('elementor/frontend/init'))
    await expect(pending).resolves.toBe(false)
  })
})
