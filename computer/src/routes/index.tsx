import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Terminal,
})

function Terminal() {
  return (
    <div className="flex h-screen items-center justify-center">
      <h1 className="text-2xl font-bold">lmthing computer</h1>
    </div>
  )
}
