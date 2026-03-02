import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import { router } from '@/lib/router'
import { GithubProvider } from '@/lib/github/GithubContext'
import { WorkspaceDataProvider } from '@/lib/workspaceDataContext'
import { hydrateWindowProcessEnvFromSessionCache } from '@/lib/envCrypto'

hydrateWindowProcessEnvFromSessionCache()

if (typeof window !== 'undefined') {
  const runtimeProcess = (window as Window & { process?: { env?: Record<string, string | undefined> } }).process
    ?? ((window as Window & { process?: { env?: Record<string, string | undefined> } }).process = { env: {} })

  const lmthingEnv =
    typeof __LMTHING_ENV__ !== 'undefined' && __LMTHING_ENV__
      ? __LMTHING_ENV__
      : {}

  runtimeProcess.env = {
    ...(runtimeProcess.env || {}),
    ...Object.fromEntries(Object.entries(lmthingEnv).filter(([, value]) => typeof value === 'string' && value.length > 0)),
  }
}



const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <GithubProvider>
        <WorkspaceDataProvider>
          <RouterProvider router={router} />
        </WorkspaceDataProvider>
      </GithubProvider>
    </QueryClientProvider>
  </StrictMode>,
)
