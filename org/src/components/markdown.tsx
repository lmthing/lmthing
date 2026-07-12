import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSlug from 'rehype-slug'
import rehypeHighlight from 'rehype-highlight'
import { Link } from '@tanstack/react-router'
import { resolveRelativeLink } from '@/lib/docs'
import { Mermaid } from './mermaid'

// Doc routes are resolved by the catch-all splat route, so they aren't in the
// generated route union — a permissive Link keeps SPA navigation without fighting
// the typed router.
const DocLink = Link as unknown as (props: {
  to: string
  hash?: string
  className?: string
  children?: ReactNode
}) => ReactNode

function toText(node: ReactNode): string {
  if (node == null || node === false || node === true) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(toText).join('')
  if (typeof node === 'object' && 'props' in (node as { props?: { children?: ReactNode } })) {
    return toText((node as { props?: { children?: ReactNode } }).props?.children)
  }
  return ''
}

export function Markdown({ content, docPath }: { content: string; docPath: string }) {
  const components: Components = {
    a({ href, children }) {
      const resolved = href ? resolveRelativeLink(docPath, href) : null
      if (resolved) {
        return (
          <DocLink to={resolved.route} hash={resolved.anchor}>
            {children}
          </DocLink>
        )
      }
      const external = !!href && /^[a-z]+:\/\//i.test(href)
      return (
        <a href={href} {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}>
          {children}
        </a>
      )
    },
    code({ className, children }) {
      const text = toText(children)
      const match = /language-([\w-]+)/.exec(className || '')
      const lang = match?.[1]
      if (lang === 'mermaid') return <Mermaid chart={text} />
      const isBlock = !!lang || text.includes('\n')
      if (!isBlock) return <code className="doc-code-inline">{children}</code>
      return <code className={className}>{children}</code>
    },
    pre({ node, children, ...props }) {
      const codeEl = node?.children?.[0] as { properties?: { className?: unknown } } | undefined
      const cls = codeEl?.properties?.className
      const isMermaid = Array.isArray(cls) && cls.includes('language-mermaid')
      if (isMermaid) return <>{children}</>
      return (
        <pre className="doc-pre" {...props}>
          {children}
        </pre>
      )
    },
    table({ children }) {
      return (
        <div className="doc-table-wrap">
          <table>{children}</table>
        </div>
      )
    },
  }

  return (
    <div className="doc-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSlug, [rehypeHighlight, { ignoreMissing: true, detect: false }]]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
