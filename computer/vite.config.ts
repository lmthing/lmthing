import { createViteConfig } from '@lmthing/utils/vite'

export default createViteConfig(__dirname, {
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
  },
})
