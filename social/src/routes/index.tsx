import { createFileRoute } from '@tanstack/react-router'
import { CozyThingText } from '@lmthing/ui/elements/branding/cozy-text'

export const Route = createFileRoute('/')({
  component: Feed,
})

function Feed() {
  return (
    <div className="flex h-screen items-center justify-center">
      <h1 className="text-2xl font-bold"><CozyThingText text="lmthing.social" /></h1>
    </div>
  )
}
