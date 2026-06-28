import { createFileRoute } from '@tanstack/react-router'
import { ComponentEditor } from '@lmthing/ui/components/component-editor'

function ComponentEditorPage() {
  return <ComponentEditor />
}

export const Route = createFileRoute('/$projectId/$spaceId/components/')({
  component: ComponentEditorPage,
})
