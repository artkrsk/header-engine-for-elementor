import process from 'node:process'

export default {
  slug: 'header-for-elementor',
  versionConstant: 'ARTS_HEADER_PLUGIN_VERSION',
  defineKey: '__ARTS_HEADER_VERSION__',
  esbuildTarget: 'es2022',
  entry: { ts: './src/ts/boot.ts', sass: './src/styles/index.scss' },
  bundles: [],
  bannerLines: [],
  zip: { budgetMb: 0.1 },
  paths: { php: './src/php', plugin: './src/wordpress-plugin', dist: './dist' },
  // Machine-specific: the Local site's plugin dir, from the gitignored .env (DEV_TARGET)
  devTarget: process.env.DEV_TARGET ?? null,
  // null = derived from the slug (collision-proof across sibling plugins)
  vendor: { autoloaderOnly: true, autoloaderSuffix: null },
  blueprint: null
}
