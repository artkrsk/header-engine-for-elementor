import './env.js'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const KNOWN = {
  top: ['slug', 'entry', 'paths', 'devTarget', 'esbuildTarget', 'versionConstant', 'vendor'],
  entry: ['ts', 'gate', 'sass'],
  paths: ['php', 'plugin', 'dist'],
  vendor: ['autoloaderOnly']
}

function assertKeys(obj, known, scope) {
  for (const key of Object.keys(obj)) {
    if (!known.includes(key)) {
      throw new Error(
        `Unknown config key "${scope}${key}" — remove it (every key must be read by the build)`
      )
    }
  }
}

export async function loadCtx() {
  const root = process.cwd()
  // Note: this module import is cached by Node — project.config.js edits need a dev restart.
  // composer.json below is read fresh on every call (the composer watcher relies on that).
  const config = (await import(pathToFileURL(path.join(root, 'project.config.js')).href)).default

  assertKeys(config, KNOWN.top, '')
  assertKeys(config.entry ?? {}, KNOWN.entry, 'entry.')
  assertKeys(config.paths ?? {}, KNOWN.paths, 'paths.')
  assertKeys(config.vendor ?? {}, KNOWN.vendor, 'vendor.')

  for (const key of ['slug', 'esbuildTarget', 'versionConstant']) {
    if (typeof config[key] !== 'string' || config[key] === '') {
      throw new Error(`Missing required config key "${key}"`)
    }
  }
  if (typeof config.entry?.ts !== 'string') {
    throw new Error('Missing required config key "entry.ts"')
  }
  if (config.entry?.gate != null && typeof config.entry.gate !== 'string') {
    throw new Error('"entry.gate" must be a path string, null, or omitted')
  }
  if (config.entry.sass !== null && typeof config.entry.sass !== 'string') {
    throw new Error('"entry.sass" must be a path string or null')
  }
  for (const key of ['php', 'plugin', 'dist']) {
    if (typeof config.paths?.[key] !== 'string') {
      throw new Error(`Missing required config key "paths.${key}"`)
    }
  }
  if (config.devTarget !== null && typeof config.devTarget !== 'string') {
    throw new Error('"devTarget" must be a path string or null')
  }
  if (typeof config.vendor?.autoloaderOnly !== 'boolean') {
    throw new Error('Missing required config key "vendor.autoloaderOnly"')
  }

  const composer = JSON.parse(readFileSync(path.join(root, 'composer.json'), 'utf8'))
  if (!composer.version) {
    throw new Error('composer.json needs a "version" field — it is the single version source')
  }

  const author = composer.authors?.[0] ?? {}
  const header = {
    'Plugin Name': '',
    Description: composer.description ?? '',
    Version: composer.version,
    Author: author.name ?? '',
    'Author URI': author.homepage ?? '',
    'Plugin URI': composer.homepage ?? '',
    License: composer.license ?? '',
    ...composer.wordpress,
    ...composer.plugin
  }
  if (!header['Plugin Name']) {
    throw new Error('composer.json plugin["Plugin Name"] is required (display name source)')
  }

  const banner = [
    '/*!',
    ` * ${header['Plugin Name']} v${composer.version}`,
    ` * © ${new Date().getFullYear()} ${header.Author}`.trimEnd(),
    ` * License: ${header.License}`,
    ` * ${header['Plugin URI']}`.trimEnd(),
    ' */'
  ].join('\n')

  const abs = (p) => path.resolve(root, p)
  const php = abs(config.paths.php)
  const plugin = abs(config.paths.plugin)
  const dist = abs(config.paths.dist)
  const libraryDir = path.join(php, 'libraries', config.slug)

  return Object.freeze({
    root,
    config,
    composer,
    version: composer.version,
    header,
    banner,
    paths: Object.freeze({
      php,
      plugin,
      dist,
      libraryDir,
      tsEntry: abs(config.entry.ts),
      gateEntry: config.entry.gate ? abs(config.entry.gate) : null,
      sassEntry: config.entry.sass ? abs(config.entry.sass) : null,
      jsOut: path.join(libraryDir, `${config.slug}.js`),
      gateOut: config.entry.gate ? path.join(libraryDir, 'gate.js') : null,
      cssOut: path.join(libraryDir, `${config.slug}.css`),
      mainFile: path.join(plugin, `${config.slug}.php`),
      readme: path.join(plugin, 'readme.txt'),
      composerJson: path.join(root, 'composer.json'),
      composerLock: path.join(root, 'composer.lock'),
      packageJson: path.join(root, 'package.json'),
      vendor: path.join(root, 'vendor'),
      vendorPrefixed: path.join(root, 'vendor-prefixed'),
      staging: path.join(dist, config.slug),
      zip: path.join(dist, `${config.slug}.zip`),
      devTarget: config.devTarget ? abs(config.devTarget) : null
    })
  })
}
