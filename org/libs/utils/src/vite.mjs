import { defineConfig } from 'vite-plus'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __utilsDir = path.dirname(fileURLToPath(import.meta.url))
const emptyStub = path.resolve(__utilsDir, 'stubs/empty.ts')
const aiSdkStub = path.resolve(__utilsDir, 'stubs/ai-sdk-provider.ts')

/**
 * @param {string} dirname
 * @param {import('vite-plus').UserConfig} [overrides]
 */
export function createViteConfig(dirname, overrides) {
  const libsDir = path.resolve(dirname, '../org/libs')

  return defineConfig({
    plugins: [
      tanstackRouter({
        routesDirectory: './src/routes',
        generatedRouteTree: './src/routeTree.gen.ts',
      }),
      react(),
      tailwindcss(),
      {
        name: 'resolve-workspace-deps',
        enforce: 'pre',
        async resolveId(source, importer, options) {
          if (!importer || source.startsWith('.') || source.startsWith('/') || source.startsWith('@lmthing/') || source.startsWith('@/')) return null
          if (!importer.startsWith(libsDir)) return null
          const resolved = await this.resolve(source, path.resolve(dirname, 'src/main.tsx'), { ...options, skipSelf: true })
          return resolved
        },
      },
      ...(overrides?.plugins ?? []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(dirname, './src'),
        '@lmthing/ui': path.resolve(dirname, '../org/libs/ui/src'),
        '@lmthing/css': path.resolve(dirname, '../org/libs/css/src'),
        'lmthing': path.resolve(dirname, '../org/libs/core/src'),
        '@lmthing/state': path.resolve(dirname, '../org/libs/state/src'),
        '@lmthing/auth': path.resolve(dirname, '../org/libs/auth/src'),
        'vm2': emptyStub,
        'coffee-script': emptyStub,
        '@ai-sdk/anthropic': aiSdkStub,
        '@ai-sdk/openai': aiSdkStub,
        '@ai-sdk/google': aiSdkStub,
        '@ai-sdk/mistral': aiSdkStub,
        '@ai-sdk/azure': aiSdkStub,
        '@ai-sdk/groq': aiSdkStub,
        '@ai-sdk/cohere': aiSdkStub,
        '@ai-sdk/amazon-bedrock': aiSdkStub,
        '@ai-sdk/openai-compatible': aiSdkStub,
        ...overrides?.resolve?.alias,
      },
    },
    server: {
      allowedHosts: ['.local'],
      ...overrides?.server,
    },
    define: {
      'process.env': '{}',
      ...overrides?.define,
    },
  })
}
