import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { UiThemeProvider } from '@lmthing/ui/theme'
import { AppProvider } from '@lmthing/state'
import { AuthProvider } from '@lmthing/auth'
import { Shell } from './Shell'
import './index.css'

const rootElement = document.getElementById('root')!

ReactDOM.createRoot(rootElement).render(
  <StrictMode>
    {/* Every `@lmthing/ui` element is a Tamagui component and calls `useTheme()`; without this
        provider the LoginScreen below renders its error boundary instead (see `@lmthing/ui`
        `src/theme/provider.tsx`, and every other surface's main.tsx). */}
    <UiThemeProvider>
      <AppProvider>
        <AuthProvider appName="chat">
          <Shell />
        </AuthProvider>
      </AppProvider>
    </UiThemeProvider>
  </StrictMode>,
)
