import { globSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'

const root = path.resolve(process.cwd(), 'playground')

export default defineConfig({
  root,
  resolve: {
    alias: {
      '@engine': path.resolve(process.cwd(), 'src/ts/index.ts'),
      '@styles': path.resolve(process.cwd(), 'src/styles')
    }
  },
  build: {
    outDir: path.resolve(process.cwd(), 'dist-playground'),
    rollupOptions: {
      input: Object.fromEntries(
        ['index.html', ...globSync('pages/*/index.html', { cwd: root })].map((f) => [
          f === 'index.html' ? 'index' : (f.split('/')[1] ?? f),
          path.join(root, f)
        ])
      )
    }
  }
})
