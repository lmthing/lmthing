import { createElement } from 'react'
import type { SerializedJSX } from '../../session/types'

/**
 * Renders a SerializedJSX tree from the agent sandbox into React elements.
 *
 * SerializedJSX has the shape:
 * { component: string, props: Record<string, unknown>, children?: SerializedJSX[] }
 *
 * Only safe HTML elements are allowed. Unknown components render as divs.
 */

const SAFE_ELEMENTS = new Set([
  'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'a', 'strong', 'em', 'code', 'pre', 'br', 'hr', 'img',
  'section', 'article', 'header', 'footer', 'nav', 'main',
  'details', 'summary', 'blockquote', 'figure', 'figcaption',
  'label', 'input', 'textarea', 'select', 'option', 'button',
  'form', 'fieldset', 'legend',
])

const BLOCKED_PROPS = new Set([
  'dangerouslySetInnerHTML', 'onError', 'onLoad',
])

interface JSXRendererProps {
  jsx: SerializedJSX
}

export function JSXRenderer({ jsx }: JSXRendererProps) {
  return renderNode(jsx, 0)
}

function renderNode(node: SerializedJSX, index: number): React.ReactElement {
  const tag = SAFE_ELEMENTS.has(node.component) ? node.component : 'div'

  // Filter dangerous props and event handlers (except form-related ones)
  const safeProps: Record<string, unknown> = { key: index }
  for (const [key, value] of Object.entries(node.props ?? {})) {
    if (BLOCKED_PROPS.has(key)) continue
    if (key.startsWith('on') && typeof value === 'string') continue
    safeProps[key] = value
  }

  const children = node.children?.map((child, i) => {
    if (typeof child === 'string') return child
    return renderNode(child, i)
  })

  return createElement(tag, safeProps, ...(children ?? []))
}
