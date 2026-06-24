import { createFileRoute } from '@tanstack/react-router'
import { SettingsView } from '@lmthing/ui/components/shell/settings-view'

export const Route = createFileRoute('/$projectId/$spaceId/settings/')({
  component: () => <SettingsView isOpen />,
})
