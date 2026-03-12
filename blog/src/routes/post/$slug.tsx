import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/post/$slug')({
  component: PostDetail,
})

function PostDetail() {
  const { slug } = Route.useParams()
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">{slug}</h1>
    </div>
  )
}
