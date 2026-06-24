import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { useState } from 'react'
import { useSpaceFS } from '@lmthing/state'
import { useTasklistList } from '@lmthing/ui/hooks/useTasklistList'
import { TasklistList, SaveTasklistModal } from '@lmthing/ui/components/workflow'

function TasklistListPage() {
  const params = useParams({ strict: false }) as {
    projectId?: string; spaceId?: string
  }
  const { projectId, spaceId } = params
  const navigate = useNavigate()
  const spaceFS = useSpaceFS()
  const tasklists = useTasklistList()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedName, setSelectedName] = useState<string | null>(null)

  const spacePath = projectId && spaceId
    ? `/${projectId}/${spaceId}`
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

export const Route = createFileRoute('/$projectId/$spaceId/workflow/')({
  component: TasklistListPage,
})
