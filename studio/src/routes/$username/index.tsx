import { createFileRoute } from '@tanstack/react-router'
import { StudiosLayout } from '@lmthing/ui/components/shell/studios-layout'

export const Route = createFileRoute('/$username/')({
  component: () => <StudiosLayout />,
})
