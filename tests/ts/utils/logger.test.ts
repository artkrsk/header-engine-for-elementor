import { logger } from '@ts/utils'
import { describe, expect, it, vi } from 'vitest'

describe('logger', () => {
  it('prefixes errors with the scoped ERROR tag', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    logger.error('boom', { detail: 1 })
    expect(spy).toHaveBeenCalledWith(':Header [ERROR] boom', { detail: 1 })
  })

  it('prefixes warnings with the scoped WARN tag', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    logger.warn('careful')
    expect(spy).toHaveBeenCalledWith(':Header [WARN] careful')
  })
})
