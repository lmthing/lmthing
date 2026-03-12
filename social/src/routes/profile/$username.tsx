import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/profile/$username')({
  component: Profile,
})

function Profile() {
  const { username } = Route.useParams()
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Profile: {username}</h1>
    </div>
  )
}
