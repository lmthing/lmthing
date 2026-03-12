import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/docs')({
  component: Docs,
})

function Docs() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Documentation</h1>
    </div>
  )
}
