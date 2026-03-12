import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Feed,
})

function Feed() {
  return (
    <div className="flex h-screen items-center justify-center">
      <h1 className="text-2xl font-bold">lmthing social</h1>
    </div>
  )
}
