import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    css: false,
    exclude: ['**/node_modules/**', '**/e2e/**', '**/*.spec.ts'],
  },
  resolve: {
    alias: [
      {
        find: /^.*\.css$/,
        replacement: path.resolve(__dirname, './src/test-mocks/style-stub.ts'),
      },
      {
        find: '@',
        replacement: path.resolve(__dirname, './src'),
      },
    ],
  },
})
