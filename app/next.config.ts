import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@lmthing/state', 'lmthing'],
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, './src'),
      'lmthing': path.resolve(__dirname, '../lib/core/src'),
      '@lmthing/state': path.resolve(__dirname, '../lib/state/src'),
    }
    return config
  },
}

export default nextConfig
