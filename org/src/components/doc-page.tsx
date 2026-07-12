import { Link } from '@tanstack/react-router'
import { FileQuestion } from 'lucide-react'
import { getDocForRoute } from '@/lib/docs'
import { Markdown } from './markdown'

export function DocPage({ route }: { route: string }) {
  const doc = getDocForRoute(route)

  if (!doc) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
        <span
          className="flex h-14 w-14 items-center justify-center rounded-full bg-muted"
          aria-hidden="true"
        >
          <FileQuestion className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
        </span>
        <h1 className="text-2xl font-bold text-foreground">Page not found</h1>
        <p className="text-muted-foreground">
          No documentation exists at{' '}
          <code className="doc-code-inline">{route}</code>.
        </p>
        <Link
          to="/"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Back to home
        </Link>
      </div>
    )
  }

  return (
    <article className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
      <Markdown content={doc.content} docPath={doc.docPath} />
    </article>
  )
}
