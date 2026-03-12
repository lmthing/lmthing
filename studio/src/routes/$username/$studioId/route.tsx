import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useApp } from '@lmthing/state'
import { StudioProvider } from '@/lib/contexts/StudioContext'

function StudioLayout() {
  const { username, studioId } = Route.useParams()
  const { currentStudioKey, setCurrentStudio } = useApp()

  useEffect(() => {
    const expectedKey = `${username}/${studioId}`
    if (currentStudioKey !== expectedKey) {
      setCurrentStudio(username, studioId)
    }
  }, [username, studioId, currentStudioKey, setCurrentStudio])

  return (
    <StudioProvider>
      <Outlet />
    </StudioProvider>
  )
}

export const Route = createFileRoute('/$username/$studioId')({
  component: StudioLayout,
})
