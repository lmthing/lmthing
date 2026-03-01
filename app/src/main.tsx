import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import { router } from '@/lib/router'
import { GithubProvider } from '@/lib/github/GithubContext'
import { WorkspaceDataProvider } from '@/lib/workspaceDataContext'

if (typeof window !== 'undefined') {
  const runtimeProcess = (window as Window & { process?: { env?: Record<string, string | undefined> } }).process
    ?? ((window as Window & { process?: { env?: Record<string, string | undefined> } }).process = { env: {} })

  runtimeProcess.env = {
    ...(runtimeProcess.env || {}),
    ...Object.fromEntries(Object.entries(__LMTHING_ENV__).filter(([, value]) => typeof value === 'string' && value.length > 0)),
  }
}

if (import.meta.env.DEV) {
  void import('@/lib/runPromptSmoke').then(async ({ runPromptSmoke }) => {
    const smoke = await runPromptSmoke()
    ;(window as Window & { __lmthingRunPromptSmoke?: unknown }).__lmthingRunPromptSmoke = smoke
    if (!smoke.ok) {
      console.error('[lmthing] runPrompt failed:', smoke.error)
    }
  })
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
