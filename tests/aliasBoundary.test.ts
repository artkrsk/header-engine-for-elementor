import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The `@ts/*` alias is a test-side convenience mapped in tsconfig and vitest.config — nothing a
 * consumer ever sees. Monorepo consumers compile src/ts straight from source with their own config
 * (via the `@engine` alias to index.ts), so a single aliased import inside src/ts would break every
 * external consumer while this repo keeps compiling. This suite is the mechanical guard on that
 * boundary.
 */

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]
  )

describe('the alias boundary', () => {
  it('keeps the @ts alias out of shipped source', () => {
    const offenders = walk('src/ts')
      .filter((file) => file.endsWith('.ts'))
      .filter((file) => /from '@ts\//.test(readFileSync(file, 'utf-8')))

    expect(offenders).toEqual([])
  })
})
