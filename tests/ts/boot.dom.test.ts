// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'

const flush = async (): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

afterEach(() => {
  ;(window as { artsHeaderForElementor?: unknown }).artsHeaderForElementor = undefined
})

describe('boot', () => {
  it('self-executes init and eventually populates the window global', async () => {
    vi.resetModules()
    await import('@ts/boot')
    await flush()
    expect(window.artsHeaderForElementor).toBeDefined()
  })

  it('default-exports the app factory for direct bundle importers', async () => {
    vi.resetModules()
    const boot = await import('@ts/boot')
    const { createHeaderApp } = await import('@ts/elementor/createHeaderApp')
    expect(boot.default).toBe(createHeaderApp)
  })
})
