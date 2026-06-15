import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { useState } from 'react'
import { useSpaceFS } from '@lmthing/state'
import { useTasklistList } from '@lmthing/ui/hooks/useTasklistList'
import { TasklistList, SaveTasklistModal } from '@lmthing/ui/components/workflow'

function TasklistListPage() {
  const params = useParams({ strict: false }) as {
    username?: string; studioId?: string; storageId?: string; spaceId?: string
  }
  const { username, studioId, storageId, spaceId } = params
  const navigate = useNavigate()
  const spaceFS = useSpaceFS()
  const tasklists = useTasklistList()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedName, setSelectedName] = useState<string | null>(null)

  const spacePath = username && studioId && storageId && spaceId
    ? `/${username}/${studioId}/${storageId}/${spaceId}`
    : ''

  const handleSelect = (name: string) => {
    setSelectedName(name)
    navigate({ to: `${spacePath}/workflow/${encodeURIComponent(name)}` })
  }

  const handleDelete = (name: string) => {
    if (!spaceFS) return
    const entries = spaceFS.readDir(`tasklists/${name}`)
    for (const entry of entries) {
      if (entry.type === 'file') {
        spaceFS.deleteFile(`tasklists/${name}/${entry.name}`)
      }
    }
  }

  const handleSaved = (name: string) => {
    navigate({ to: `${spacePath}/workflow/${encodeURIComponent(name)}` })
  }

  return (
    <>
      <TasklistList
        tasklists={tasklists}
        selectedName={selectedName}
        onSelectTasklist={handleSelect}
        onCreateTasklist={() => setIsModalOpen(true)}
        onDeleteTasklist={handleDelete}
      />
      <SaveTasklistModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={handleSaved}
      />
    </>
  )
}

export const Route = createFileRoute(
  '/$username/$studioId/$storageId/$spaceId/workflow/',
)({
  component: TasklistListPage,
})
