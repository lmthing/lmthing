import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$spaceSlug/app/$page')({
  component: DynamicPage,
})

function DynamicPage() {
  const { page } = Route.useParams()

  return (
    <div className="p-8">
      <h1 className="mb-4 text-2xl font-bold capitalize">{page}</h1>
      <p className="text-muted-foreground">Dynamic page rendering — coming soon.</p>
    </div>
  )
}
