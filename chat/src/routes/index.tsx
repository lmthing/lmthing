import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: ChatHome,
})

function ChatHome() {
  return (
    <div className="flex h-screen items-center justify-center">
      <h1 className="text-2xl font-bold">lmthing chat</h1>
    </div>
  )
}
