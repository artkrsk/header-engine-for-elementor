import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '../..')
const PHP = 'php'

/** The emitters need a `php` on PATH; the suites skip themselves when there is none. */
export const hasPhp = spawnSync(PHP, ['-v'], { encoding: 'utf8' }).status === 0

/** Reads a fixture from `tests/fixtures`. */
export const fixture = <T>(name: string): T =>
  JSON.parse(readFileSync(resolve(root, 'tests/fixtures', name), 'utf8')) as T

/**
 * Runs `tests/php/<script>` with one row per stdin entry and returns the parsed JSON line each row
 * printed. Extra args go to the script (`--bare` runs it without an `\Elementor\Plugin` class).
 */
export const runEmitter = <T>(
  script: string,
  rows: readonly unknown[],
  args: string[] = []
): T[] => {
  const result = spawnSync(PHP, [resolve(root, 'tests/php', script), ...args], {
    input: JSON.stringify(rows),
    encoding: 'utf8'
  })
  if (result.status !== 0) {
    throw new Error(`php ${script} exited ${result.status}\n${result.stderr}${result.stdout}`)
  }
  return result.stdout
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line) as T)
}

/** `runEmitter` deferred to the first call, so a skipped suite never spawns php at collection. */
export const lazyEmitter = <T>(
  script: string,
  rows: readonly unknown[],
  args: string[] = []
): (() => T[]) => {
  let results: T[] | undefined
  return () => {
    results ??= runEmitter<T>(script, rows, args)
    return results
  }
}

/** The four render-time attributes buckets of a faked Elementor element: name -> values. */
export type TRenderAttributes = Record<string, Record<string, string[]>>

/** One element's trip through the Markup hooks (see `tests/php/markup.php`). */
export interface IRenderedElement {
  id: string
  attributes: TRenderAttributes
  before: string
  after: string
}

/** Settings a fake element renders with: `arts_header_*` keys, values of any JSON type. */
export type TPanelSettings = Record<string, unknown>

/** A fake Elementor element the `render` op feeds through the Markup hooks. */
export interface IFakeElement {
  id: string
  type: 'container' | 'widget'
  settings: TPanelSettings
}

/** Renders `elements` in order inside one request; the primary-header tracker starts fresh. */
export const renderElements = (elements: IFakeElement[]): IRenderedElement[] => {
  const [result] = runEmitter<{ elements: IRenderedElement[] }>('markup.php', [
    { op: 'render', elements }
  ])
  return result?.elements ?? []
}

/** Renders each settings object as a lone element, one PHP process for the whole batch. */
export const renderEach = (
  settingsList: TPanelSettings[],
  type: IFakeElement['type'] = 'container'
): IRenderedElement[] =>
  runEmitter<{ elements: IRenderedElement[] }>(
    'markup.php',
    settingsList.map((settings) => ({
      op: 'render',
      elements: [{ id: 'abc123', type, settings }]
    }))
  ).map((result) => {
    const [element] = result.elements
    if (!element) {
      throw new Error('markup.php returned no element')
    }
    return element
  })
