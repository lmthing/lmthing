import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Marketplace,
})

function Marketplace() {
  return (
    <div className="flex h-screen items-center justify-center">
      <h1 className="text-2xl font-bold">lmthing store</h1>
    </div>
  )
}
