import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { projects } from './src/data/projects.js'

export default defineConfig({
  base: '/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        ...Object.fromEntries(projects.map((p) => [p.slug, resolve(import.meta.dirname, `projects/${p.slug}/index.html`)])),
      },
    },
  },
})
