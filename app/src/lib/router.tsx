import { createBrowserRouter } from 'react-router-dom'
import LandingLayout from '@/shell/LandingLayout'
import MarketplaceLayout from '@/shell/MarketplaceLayout'
import StudioLayout from '@/shell/StudioLayout'
import WorkspacesLayout from '@/shell/WorkspacesLayout'

export const router = createBrowserRouter([
  // Landing page
  {
    path: '/',
    element: <LandingLayout />,
  },
  {
    path: '/marketplace',
    element: <MarketplaceLayout />,
  },
  // Workspaces overview
  {

  },
  {
    path: '/studio',
    element: <WorkspacesLayout />,
  },
  // Workspace-based Studio app with nested routes
  {
    path: '/studio/:workspaceName/',
    element: <StudioLayout />,
    children: [
      // Default list view
      { index: true },
      // Settings view with tabs
      { path: 'settings' },
      { path: 'settings/env' },
      { path: 'settings/package-json' },
      // Knowledge detail view
      { path: 'knowledge/:domainId' },
      // Assistant detail view
      { path: 'assistant/:agentId' },
      // Assistant conversation view in studio
      { path: 'assistant/:agentId/conversation/:conversationId' },
      // Assistant flow editing view (shows modal)
      { path: 'assistant/:agentId/actions/:actionId' },
    ],
  },
],
  { basename: import.meta.env.BASE_URL }
)

