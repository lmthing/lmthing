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
  define: {
    'process.env': '{}',
  },
})
