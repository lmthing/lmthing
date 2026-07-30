import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { UiThemeProvider } from '@lmthing/ui/theme'
import { routeTree } from './routeTree.gen'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')!

ReactDOM.createRoot(rootElement).render(
  <StrictMode>
    {/* Every `@lmthing/ui` element is a Tamagui component and calls `useTheme()`; without this
        provider at the root the whole SPA renders its error boundary. See `@lmthing/ui`
        `src/theme/provider.tsx`. */}
    <UiThemeProvider>
      <RouterProvider router={router} />
    </UiThemeProvider>
  </StrictMode>,
)
