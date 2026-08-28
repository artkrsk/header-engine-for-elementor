import { createVitestConfig } from '@arts/wp-plugin-tooling/vitest'
import { defineConfig } from 'vitest/config'

// Shared shape (node env, @ts test-only alias, istanbul-format coverage). No setup file:
// this repo's source never references import.meta.env, so there is no DEV
// stubbing to do.
export default defineConfig(
  createVitestConfig({ defineKey: '__ARTS_HEADER_VERSION__', setupFiles: [] })
)
