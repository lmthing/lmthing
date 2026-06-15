/**
 * New Tasklist route — shows the create modal then navigates to the editor.
 */
import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { SaveTasklistModal } from '@lmthing/ui/components/workflow'

function NewTasklistPage() {
  const params = useParams({ strict: false }) as {
    username?: string; studioId?: string; storageId?: string; spaceId?: string
  }
  const { username, studioId, storageId, spaceId } = params
  const navigate = useNavigate()

  const spacePath = username && studioId && storageId && spaceId
    ? `/${username}/${studioId}/${storageId}/${spaceId}`
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

export const Route = createFileRoute(
  '/$username/$studioId/$storageId/$spaceId/workflow/new/',
)({
  component: NewTasklistPage,
})
