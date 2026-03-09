import { Button } from '@/elements/forms/button'
import {
  Bold,
  Italic,
  Heading1,
  List,
  ListOrdered,
  Code,
  Code2,
  Link,
  Quote,
  Minus,
  Eye,
  Pencil,
} from 'lucide-react'

export type FormatAction =
  | 'bold'
  | 'italic'
  | 'heading'
  | 'bullet-list'
  | 'numbered-list'
  | 'inline-code'
  | 'code-block'
  | 'link'
  | 'blockquote'
  | 'hr'

export type EditorMode = 'edit' | 'preview'

interface MarkdownToolbarProps {
  mode: EditorMode
  onFormat: (action: FormatAction) => void
  onModeChange: (mode: EditorMode) => void
}

const iconStyle = { width: '0.875rem', height: '0.875rem' }

export function MarkdownToolbar({ mode, onFormat, onModeChange }: MarkdownToolbarProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.125rem',
      padding: '0.25rem 0.5rem',
      borderBottom: '1px solid var(--color-border)',
      flexWrap: 'wrap',
    }}>
      <Button variant="ghost" size="icon" onClick={() => onFormat('bold')} title="Bold (Ctrl+B)" disabled={mode === 'preview'}>
        <Bold style={iconStyle} />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => onFormat('italic')} title="Italic (Ctrl+I)" disabled={mode === 'preview'}>
        <Italic style={iconStyle} />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => onFormat('heading')} title="Heading" disabled={mode === 'preview'}>
        <Heading1 style={iconStyle} />
      </Button>

      <span style={{ width: '1px', height: '1.25rem', backgroundColor: 'var(--color-border)', margin: '0 0.25rem' }} />

      <Button variant="ghost" size="icon" onClick={() => onFormat('bullet-list')} title="Bullet list" disabled={mode === 'preview'}>
        <List style={iconStyle} />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => onFormat('numbered-list')} title="Numbered list" disabled={mode === 'preview'}>
        <ListOrdered style={iconStyle} />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => onFormat('blockquote')} title="Blockquote" disabled={mode === 'preview'}>
        <Quote style={iconStyle} />
      </Button>

      <span style={{ width: '1px', height: '1.25rem', backgroundColor: 'var(--color-border)', margin: '0 0.25rem' }} />

      <Button variant="ghost" size="icon" onClick={() => onFormat('inline-code')} title="Inline code" disabled={mode === 'preview'}>
        <Code style={iconStyle} />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => onFormat('code-block')} title="Code block" disabled={mode === 'preview'}>
        <Code2 style={iconStyle} />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => onFormat('link')} title="Link" disabled={mode === 'preview'}>
        <Link style={iconStyle} />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => onFormat('hr')} title="Horizontal rule" disabled={mode === 'preview'}>
        <Minus style={iconStyle} />
      </Button>

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', gap: '0.125rem' }}>
        <Button
          variant={mode === 'edit' ? 'outline' : 'ghost'}
          size="sm"
          onClick={() => onModeChange('edit')}
          style={{ gap: '0.25rem' }}
        >
          <Pencil style={{ width: '0.75rem', height: '0.75rem' }} />
          Edit
        </Button>
        <Button
          variant={mode === 'preview' ? 'outline' : 'ghost'}
          size="sm"
          onClick={() => onModeChange('preview')}
          style={{ gap: '0.25rem' }}
        >
          <Eye style={{ width: '0.75rem', height: '0.75rem' }} />
          Preview
        </Button>
      </div>
    </div>
  )
}
