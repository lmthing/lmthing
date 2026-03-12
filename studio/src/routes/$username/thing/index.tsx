import { createFileRoute } from '@tanstack/react-router'
import { ThingPanel } from '@lmthing/ui/components/thing/thing-panel'

export const Route = createFileRoute('/$username/thing/')({
  component: () => <ThingPanel fullPage />,
})
