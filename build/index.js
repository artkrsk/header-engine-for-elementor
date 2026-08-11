#!/usr/bin/env node
import process from 'node:process'
import { loadCtx } from './config.js'
import { watchJs } from './js.js'
import { log } from './log.js'
import { stampAll } from './meta.js'
import { buildRelease } from './package.js'
import { buildCss, watchCss } from './sass.js'
import { initialMirror, watchComposer, watchSources } from './sync.js'

async function dev(ctx) {
  // Deviation from the template: DEV_TARGET is optional. Without it, dev mode
  // only compiles into src/php/libraries/ — the composer-symlink consumers
  // (velum-core) run their own sync pipeline over that directory.
  const syncing = Boolean(ctx.paths.devTarget)
  if (!syncing) {
    log.info('No DEV_TARGET — building without sync (composer-symlink workflow)')
  }
  stampAll(ctx)
  const js = await watchJs(ctx, ctx.paths.jsOut)
  const gateBundle = ctx.paths.gateEntry
    ? await watchJs(ctx, ctx.paths.gateOut, {
        entry: ctx.paths.gateEntry,
        banner: '',
        sourcemap: false
      })
    : null
  buildCss(ctx, { dev: true, outfile: ctx.paths.cssOut })
  await Promise.all([js.firstBuild, gateBundle?.firstBuild].filter(Boolean))
  if (syncing) {
    initialMirror(ctx)
  }
  const watchers = [
    syncing ? watchSources(ctx) : null,
    watchCss(ctx, ctx.paths.cssOut),
    syncing ? watchComposer(ctx) : null
  ].filter(Boolean)
  log.success('Dev mode running — Ctrl+C to stop')
  process.on('SIGINT', async () => {
    log.info('Shutting down…')
    await js.dispose()
    await gateBundle?.dispose()
    await Promise.all(watchers.map((w) => w.close()))
    process.exit(0)
  })
}

const command = process.argv[2] ?? 'build'
try {
  const ctx = await loadCtx()
  if (command === 'dev') {
    await dev(ctx)
  } else if (command === 'build') {
    stampAll(ctx)
    await buildRelease(ctx)
  } else {
    log.error(`Unknown command "${command}" — use: dev | build`)
    process.exit(1)
  }
} catch (err) {
  log.error(err)
  process.exit(1)
}
