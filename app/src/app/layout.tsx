'use client'

import { AppProvider } from '@/lib/contexts/AppContext'
import { GithubProvider } from '@/lib/github/GithubContext'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@/index.css'

const queryClient = new QueryClient()

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Nunito:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppProvider>
          <QueryClientProvider client={queryClient}>
            <GithubProvider>
              {children}
            </GithubProvider>
          </QueryClientProvider>
        </AppProvider>
      </body>
    </html>
  )
}
