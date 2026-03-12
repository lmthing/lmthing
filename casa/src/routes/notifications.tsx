import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/notifications')({
  component: Notifications,
})

function Notifications() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Notifications</h1>
    </div>
  )
}
