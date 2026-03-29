import { createFileRoute } from '@tanstack/react-router'

const COMPUTER_URL = import.meta.env.VITE_COMPUTER_URL
  ?? (import.meta.env.DEV ? 'https://computer.local' : 'https://lmthing.computer')

export const Route = createFileRoute('/')({
  component: ChatHome,
})

function ChatHome() {
  return (
    <iframe
      src={`${COMPUTER_URL}/chat`}
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', border: 'none' }}
      allow="cross-origin-isolated"
      title="lmthing"
    />
  )
}
