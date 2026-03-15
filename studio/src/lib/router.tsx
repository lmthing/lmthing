import { createBrowserRouter } from 'react-router-dom'
import LandingLayout from '@/shell/LandingLayout'
import MarketplaceLayout from '@/shell/MarketplaceLayout'
import PresentationLayout from '@/shell/PresentationLayout'
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
  {
    path: '/presentation',
    element: <PresentationLayout />,
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
      // Agent detail view
      { path: 'agent/:agentId' },
      // Agent conversation view in studio
      { path: 'agent/:agentId/conversation/:conversationId' },
      // Agent flow editing view (shows modal)
      { path: 'agent/:agentId/actions/:actionId' },
    ],
  },
],
  { basename: import.meta.env.BASE_URL }
)

