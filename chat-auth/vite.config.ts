import { createViteConfig } from '@lmthing/utils/vite'

// Served under the `/auth` prefix (devops/argocd/envoy/chat-routes.yaml's `chat-auth-static`
// route), not at domain root like every other SPA this factory serves — without `base`, the built
// bundle references `/assets/...` at the domain root, which falls through to the JWT-protected
// document catch-all (`chat-document-proxy`) and 401s for every visitor with no session yet.
export default createViteConfig(__dirname, { base: '/auth/' })
