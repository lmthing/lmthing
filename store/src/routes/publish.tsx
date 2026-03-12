import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/publish')({
  component: Publish,
})

function Publish() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Publish Agent</h1>
    </div>
  )
}
