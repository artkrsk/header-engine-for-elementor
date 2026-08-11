import path from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * The playground carries its own Vite config (vite.config.ts); this file configures Vitest alone.
 *
 * `node` is the default environment because most of the engine — the option resolvers, the pure
 * sticky deciders — needs no DOM, and a node default makes an accidental `document` reach fail
 * loudly instead of passing against a fake. Files that need a DOM opt in with a
 * `// @vitest-environment happy-dom` docblock (jsdom is not an option: it has no matchMedia,
 * ResizeObserver or IntersectionObserver).
 */
export default defineConfig({
  resolve: {
    // Test-only alias — tests live in tests/ and reach the engine through it. Never valid inside
    // src/ts itself: monorepo consumers compile that source with their own config and would
    // inherit the alias requirement. The alias-boundary test enforces the split.
    alias: {
      '@ts': path.resolve(process.cwd(), 'src/ts')
    }
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    restoreMocks: true,
    // vi.stubGlobal is NOT reverted between tests by default, and the DOM tier stubs
    // IntersectionObserver/ResizeObserver/MutationObserver constructors.
    unstubGlobals: true,
    coverage: {
      // Istanbul rather than the default v8: fallow's `health --coverage` reads Istanbul-format
      // `coverage-final.json` only, and silently reports nothing useful when handed v8 output.
      provider: 'istanbul',
      // v4 removed `coverage.all` and reports only files loaded during the run unless `include`
      // says otherwise — without this an untested module is simply absent rather than uncovered.
      include: ['src/ts/**/*.ts'],
      exclude: ['src/ts/**/*.d.ts', 'src/ts/interfaces/**', 'src/ts/types/**', 'src/ts/index.ts'],
      // `json` is what writes coverage/coverage-final.json for fallow.
      reporter: ['text', 'html', 'json']
    }
  }
})
