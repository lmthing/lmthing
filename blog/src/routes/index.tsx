import { createFileRoute } from '@tanstack/react-router'
import { CozyThingText } from '@lmthing/ui/elements/branding/cozy-text'

export const Route = createFileRoute('/')({
  component: BlogHome,
})

function BlogHome() {
  return (
    <div className="flex h-screen items-center justify-center">
      <h1 className="text-2xl font-bold"><CozyThingText text="lmthing.blog" /></h1>
    </div>
  )
}
