import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/profile')({
  component: Profile,
})

function Profile() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Profile</h1>
    </div>
  )
}
