import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import { router } from '@/lib/router'
import { GithubProvider } from '@/lib/github/GithubContext'
import { WorkspaceDataProvider } from '@/lib/workspaceDataContext'

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
