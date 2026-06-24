import { createFileRoute, Outlet } from '@tanstack/react-router'
import { ProjectProvider } from '@lmthing/state'

export const Route = createFileRoute('/$projectId')({
  component: () => (
    <ProjectProvider>
      <Outlet />
    </ProjectProvider>
  ),
})
