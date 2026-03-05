import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { readFileSync } from 'node:fs'

const appPackageJson = JSON.parse(
  readFileSync(path.resolve(__dirname, './package.json'), 'utf-8'),
) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appPackageJson.version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'lmthing': path.resolve(__dirname, '../lib/core/src'),
      '@lmthing/state': path.resolve(__dirname, '../lib/state/src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/github-proxy': {
        target: 'https://github.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/github-proxy/, '')
      }
    }
  },
})
