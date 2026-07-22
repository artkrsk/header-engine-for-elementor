import process from 'node:process'

export default {
  slug: 'header-for-elementor',
  entry: { ts: './src/ts/boot.ts', sass: './src/styles/index.sass' },
  paths: { php: './src/php', plugin: './src/wordpress-plugin', dist: './dist' },
  // Machine-specific: the Local site's plugin dir, from the gitignored .env (DEV_TARGET)
  devTarget: process.env.DEV_TARGET ?? null,
  esbuildTarget: 'es2018',
  versionConstant: 'ARTS_HEADER_PLUGIN_VERSION',
  // Strauss copies prefixed arts/* into vendor-prefixed/; vendor/ ships the autoloader only.
  vendor: { autoloaderOnly: true }
}
