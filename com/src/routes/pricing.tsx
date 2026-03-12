import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/pricing')({
  component: Pricing,
})

function Pricing() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Pricing</h1>
    </div>
  )
}
