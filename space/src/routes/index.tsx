import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Dashboard,
})

function Dashboard() {
  return (
    <div className="flex h-screen items-center justify-center">
      <h1 className="text-2xl font-bold">lmthing space</h1>
    </div>
  )
}
