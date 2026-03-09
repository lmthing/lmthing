import { createFileRoute, Outlet } from '@tanstack/react-router'
import { StudioProvider } from '@/lib/contexts/StudioContext'

export const Route = createFileRoute('/$username')({
  component: () => (
    <StudioProvider>
      <Outlet />
    </StudioProvider>
  ),
})
