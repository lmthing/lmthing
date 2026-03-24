import { defineConfig } from 'tsup'

const external = [
  'react',
  'react-dom',
  'ai',
  'zod',
  'typescript',
  'ws',
  'citty',
  'better-sqlite3',
  'sharp',
  '@ai-sdk/openai-compatible',
  '@ai-sdk/provider',
  '@ai-sdk/openai',
  '@ai-sdk/anthropic',
  '@ai-sdk/google',
  '@ai-sdk/azure',
  '@ai-sdk/groq',
  '@ai-sdk/mistral',
  '@ai-sdk/cohere',
  '@ai-sdk/amazon-bedrock',
]

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    dts: true,
    clean: true,
    noExternal: ['@lmthing/repl'],
    external,
  },
  {
    entry: { bin: 'src/cli/bin.ts' },
    format: ['esm'],
    dts: false,
    noExternal: ['@lmthing/repl'],
    external,
  },
])
