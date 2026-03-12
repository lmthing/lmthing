import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import path from 'path'

const libsDir = path.resolve(__dirname, '../org/libs')

export default defineConfig({
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
        const resolved = await this.resolve(source, path.resolve(__dirname, 'src/main.tsx'), { ...options, skipSelf: true })
        return resolved
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@lmthing/ui': path.resolve(__dirname, '../org/libs/ui/src'),
      '@lmthing/css': path.resolve(__dirname, '../org/libs/css/src'),
      'lmthing': path.resolve(__dirname, '../org/libs/core/src'),
      '@lmthing/state': path.resolve(__dirname, '../org/libs/state/src'),
      'vm2': path.resolve(__dirname, './src/stubs/empty.ts'),
      'coffee-script': path.resolve(__dirname, './src/stubs/empty.ts'),
      '@ai-sdk/anthropic': path.resolve(__dirname, './src/stubs/ai-sdk-provider.ts'),
      '@ai-sdk/openai': path.resolve(__dirname, './src/stubs/ai-sdk-provider.ts'),
      '@ai-sdk/google': path.resolve(__dirname, './src/stubs/ai-sdk-provider.ts'),
      '@ai-sdk/mistral': path.resolve(__dirname, './src/stubs/ai-sdk-provider.ts'),
      '@ai-sdk/azure': path.resolve(__dirname, './src/stubs/ai-sdk-provider.ts'),
      '@ai-sdk/groq': path.resolve(__dirname, './src/stubs/ai-sdk-provider.ts'),
      '@ai-sdk/cohere': path.resolve(__dirname, './src/stubs/ai-sdk-provider.ts'),
      '@ai-sdk/amazon-bedrock': path.resolve(__dirname, './src/stubs/ai-sdk-provider.ts'),
      '@ai-sdk/openai-compatible': path.resolve(__dirname, './src/stubs/ai-sdk-provider.ts'),
    },
  },
  server: {
    allowedHosts: ['.local'],
  },
  define: {
    'process.env': '{}',
  },
})
