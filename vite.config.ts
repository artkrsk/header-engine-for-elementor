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
    outDir: path.resolve(process.cwd(), 'dist-playground')
  }
})
