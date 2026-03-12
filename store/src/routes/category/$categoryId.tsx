import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/category/$categoryId')({
  component: Category,
})

function Category() {
  const { categoryId } = Route.useParams()
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Category: {categoryId}</h1>
    </div>
  )
}
