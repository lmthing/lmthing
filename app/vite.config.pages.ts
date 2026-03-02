import { mergeConfig } from 'vite'
import { githubPagesSpa } from '@sctg/vite-plugin-github-pages-spa'
import baseConfig from './vite.config'

// Node.js-only packages to externalize for browser builds
const nodeExternals = [
  // vm2 - sandboxed code execution (Node.js vm, fs, path modules)
  'vm2',
  'vm2/lib/script.js',
  'vm2/lib/vm.js',
  'vm2/lib/filesystem.js',
  // Google auth - uses Node.js events, stream, querystring
  'google-auth-library',
  'googleapis',
  // Node-fetch - Node.js HTTP client
  'node-fetch',
  'fetch-blob',
  'node-domexception',
  'agent-base',
  'https-proxy-agent',
  'http-proxy-agent',
  'socks-proxy-agent',
  // AI SDK providers that use Node.js-only deps
  '@ai-sdk/google-vertex',
  '@ai-sdk/amazon-bedrock',
  '@ai-sdk/azure',
  '@ai-sdk/groq',
  '@ai-sdk/cohere',
  '@ai-sdk/mistral',
  // Langfuse - uses Node.js modules
  'langfuse',
  '@langfuse/otel',
  '@opentelemetry/sdk-trace-node',
  '@opentelemetry/*',
]

// Extends the base Vite config with settings required for GitHub Pages hosting.
export default mergeConfig(baseConfig, {
  base: '/',
  plugins: [githubPagesSpa()],
  build: {
    rollupOptions: {
      external: nodeExternals,
      output: {
        globals: {},
      },
    },
  },
})
