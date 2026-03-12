import { createFileRoute } from '@tanstack/react-router'
import { SettingsView } from '@lmthing/ui/components/shell/settings-view'

export const Route = createFileRoute(
  '/$username/$studioId/$storageId/$spaceId/settings/packages/',
)({
  component: () => <SettingsView isOpen />,
})
