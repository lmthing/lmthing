import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">About</h1>
    </div>
  )
}
