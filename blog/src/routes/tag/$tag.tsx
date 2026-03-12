import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/tag/$tag')({
  component: TagPosts,
})

function TagPosts() {
  const { tag } = Route.useParams()
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Tag: {tag}</h1>
    </div>
  )
}
