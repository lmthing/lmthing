/**
 * New Tasklist route — shows the create modal then navigates to the editor.
 */
import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { SaveTasklistModal } from '@lmthing/ui/components/workflow'

function NewTasklistPage() {
  const params = useParams({ strict: false }) as {
    projectId?: string; spaceId?: string
  }
  const { projectId, spaceId } = params
  const navigate = useNavigate()

  const spacePath = projectId && spaceId
    ? `/${projectId}/${spaceId}`
    : ''

  const handleSaved = (name: string) => {
    navigate({ to: `${spacePath}/workflow/${encodeURIComponent(name)}` })
  }

  const handleClose = () => {
    navigate({ to: `${spacePath}/workflow` })
  }

  return (
    <SaveTasklistModal
      isOpen
      onClose={handleClose}
      onSaved={handleSaved}
    />
  )
}

export const Route = createFileRoute('/$projectId/$spaceId/workflow/new/')({
  component: NewTasklistPage,
})
