import type { NextConfig } from 'next'
import path from 'path'
import webpack from 'next/dist/compiled/webpack/webpack-lib.js'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: ['@lmthing/state', 'lmthing'],
  webpack(config, { isServer }) {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, './src'),
      'lmthing': path.resolve(__dirname, '../lib/core/src'),
      '@lmthing/state': path.resolve(__dirname, '../lib/state/src'),
    }

    // Stub Node.js built-ins that are pulled in by server-only provider SDKs
    // (e.g. google-auth-library via @ai-sdk/google-vertex). runPrompt runs
    // in the browser so these paths are never actually reached at runtime.
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        child_process: false,
        net: false,
        tls: false,
        dns: false,
        http2: false,
        async_hooks: false,
        module: false,
        vm2: false,
      }

      // Rewrite `node:*` scheme imports to their bare equivalents so
      // webpack's fallback map (or built-in polyfills) can handle them.
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^node:/,
          (resource: { request: string }) => {
            resource.request = resource.request.replace(/^node:/, '')
          },
        ),
      )
    }

    return config
  },
}

export default nextConfig
