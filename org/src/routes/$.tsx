import { createFileRoute } from '@tanstack/react-router'
import { DocPage } from '@/components/doc-page'

export const Route = createFileRoute('/$')({
  component: SplatDoc,
})

function SplatDoc() {
  const { _splat } = Route.useParams()
  const route = '/' + (_splat ?? '').replace(/\/+$/, '')
  return <DocPage route={route} />
}
