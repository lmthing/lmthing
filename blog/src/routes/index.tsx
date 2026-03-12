import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: BlogHome,
})

function BlogHome() {
  return (
    <div className="flex h-screen items-center justify-center">
      <h1 className="text-2xl font-bold">lmthing blog</h1>
    </div>
  )
}
