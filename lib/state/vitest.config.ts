import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/types/**',
        'vitest.config.ts',
        'tsup.config.ts'
      ]
    },
    setupFiles: [],
    testTimeout: 10000
  },
  resolve: {
    alias: {
      '@': '/home/vasilis/GEANT/lmthing/lib/state'
    }
  }
})
