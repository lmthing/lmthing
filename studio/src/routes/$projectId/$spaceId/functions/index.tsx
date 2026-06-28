import { createFileRoute } from '@tanstack/react-router'
import { FunctionsEditor } from '@lmthing/ui/components/functions'

function FunctionsEditorPage() {
  return <FunctionsEditor />
}

export const Route = createFileRoute('/$projectId/$spaceId/functions/')({
  component: FunctionsEditorPage,
})
