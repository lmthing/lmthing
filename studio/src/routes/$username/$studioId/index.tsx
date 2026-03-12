import { createFileRoute } from '@tanstack/react-router'
import { SpacesLayout } from '@lmthing/ui/components/shell/spaces-layout'

export const Route = createFileRoute('/$username/$studioId/')({
  component: () => <SpacesLayout />,
})
