import { createFileRoute } from '@tanstack/react-router'
import { StudiosLayout } from '@/components/shell/studios-layout'

export const Route = createFileRoute('/$username/')({
  component: () => <StudiosLayout />,
})
