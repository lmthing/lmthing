import { createFileRoute } from '@tanstack/react-router'
import { ProjectsLayout } from '@lmthing/ui/components/shell/projects-layout'

export const Route = createFileRoute('/')({
  component: () => <ProjectsLayout />,
})
