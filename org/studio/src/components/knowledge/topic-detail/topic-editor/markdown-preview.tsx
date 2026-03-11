interface MarkdownPreviewProps {
  markdown: string
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderMarkdown(md: string): string {
  let html = escapeHtml(md)

  // Code blocks (must be before inline code)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) =>
    `<pre style="background:var(--color-muted);padding:1rem;border-radius:0.375rem;overflow-x:auto;font-size:0.8125rem"><code>${code.trim()}</code></pre>`
  )

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code style="background:var(--color-muted);padding:0.125rem 0.375rem;border-radius:0.25rem;font-size:0.8125rem">$1</code>')

  // Headings
  html = html.replace(/^#### (.+)$/gm, '<h4 style="font-size:1rem;font-weight:600;margin:1rem 0 0.5rem">$1</h4>')
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:1.125rem;font-weight:600;margin:1rem 0 0.5rem">$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2 style="font-size:1.25rem;font-weight:600;margin:1.25rem 0 0.5rem">$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1 style="font-size:1.5rem;font-weight:700;margin:1.5rem 0 0.75rem">$1</h1>')

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--color-border);margin:1rem 0" />')

  // Bold & italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:var(--color-primary);text-decoration:underline" target="_blank" rel="noopener noreferrer">$1</a>')

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote style="border-left:3px solid var(--color-border);padding-left:1rem;margin:0.5rem 0;color:var(--color-muted-foreground)">$1</blockquote>')

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li style="margin-left:1.5rem;list-style:disc">$1</li>')

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li style="margin-left:1.5rem;list-style:decimal">$1</li>')

  // Line breaks (double newline = paragraph break)
  html = html.replace(/\n\n/g, '<br /><br />')
  html = html.replace(/\n/g, '<br />')

  return html
}

export function MarkdownPreview({ markdown }: MarkdownPreviewProps) {
  const html = renderMarkdown(markdown)

  return (
    <div
      dangerouslySetInnerHTML={{ __html: html }}
      style={{
        padding: '1rem',
        lineHeight: '1.7',
        fontSize: '0.875rem',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: 'var(--color-foreground)',
        height: 'calc(100vh - 14rem)',
        overflow: 'auto',
        wordWrap: 'break-word',
      }}
    />
  )
}
