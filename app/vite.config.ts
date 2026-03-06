import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    tanstackRouter({
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'lmthing': path.resolve(__dirname, '../lib/core/src'),
      '@lmthing/state': path.resolve(__dirname, '../lib/state/src'),
      'vm2': path.resolve(__dirname, './src/stubs/empty.ts'),
      'coffee-script': path.resolve(__dirname, './src/stubs/empty.ts'),
    },
  },
  define: {
    'process.env': '{}',
  },
})
