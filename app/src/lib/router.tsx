import { createBrowserRouter } from 'react-router-dom'
import LandingLayout from '@/shell/LandingLayout'
import MarketplaceLayout from '@/shell/MarketplaceLayout'
import StudioLayout from '@/shell/StudioLayout'

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
  // Workspace-based Studio app with nested routes
  {
    path: '/workspace/:workspaceName/studio',
    element: <StudioLayout />,
    children: [
      // Default list view
      { index: true },
      // Settings view with tabs
      { path: 'settings' },
      { path: 'settings/env' },
      { path: 'settings/package-json' },
      // Domain detail view
      { path: 'domain/:domainId' },
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
