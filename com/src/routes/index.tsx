import { createFileRoute } from '@tanstack/react-router'
import { CozyThingText } from '@lmthing/ui/elements/branding/cozy-text'

export const Route = createFileRoute('/')({
  component: Landing,
})

function Landing() {
  return (
    <div className="flex h-screen items-center justify-center">
      <h1 className="text-2xl font-bold"><CozyThingText text="lmthing" /></h1>
    </div>
  )
}
