import { Button } from '@lmthing/ui/elements/forms/button'
import '@lmthing/css/components/knowledge/index.css'
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

export function MarkdownToolbar({ mode, onFormat, onModeChange }: MarkdownToolbarProps) {
  return (
    <div className="markdown-toolbar">
      <Button variant="ghost" size="icon" onClick={() => onFormat('bold')} title="Bold (Ctrl+B)" disabled={mode === 'preview'}>
        <Bold className="markdown-toolbar__icon" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => onFormat('italic')} title="Italic (Ctrl+I)" disabled={mode === 'preview'}>
        <Italic className="markdown-toolbar__icon" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => onFormat('heading')} title="Heading" disabled={mode === 'preview'}>
        <Heading1 className="markdown-toolbar__icon" />
      </Button>

      <span className="markdown-toolbar__separator" />

      <Button variant="ghost" size="icon" onClick={() => onFormat('bullet-list')} title="Bullet list" disabled={mode === 'preview'}>
        <List className="markdown-toolbar__icon" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => onFormat('numbered-list')} title="Numbered list" disabled={mode === 'preview'}>
        <ListOrdered className="markdown-toolbar__icon" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => onFormat('blockquote')} title="Blockquote" disabled={mode === 'preview'}>
        <Quote className="markdown-toolbar__icon" />
      </Button>

      <span className="markdown-toolbar__separator" />

      <Button variant="ghost" size="icon" onClick={() => onFormat('inline-code')} title="Inline code" disabled={mode === 'preview'}>
        <Code className="markdown-toolbar__icon" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => onFormat('code-block')} title="Code block" disabled={mode === 'preview'}>
        <Code2 className="markdown-toolbar__icon" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => onFormat('link')} title="Link" disabled={mode === 'preview'}>
        <Link className="markdown-toolbar__icon" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => onFormat('hr')} title="Horizontal rule" disabled={mode === 'preview'}>
        <Minus className="markdown-toolbar__icon" />
      </Button>

      <div className="markdown-toolbar__spacer" />

      <div className="markdown-toolbar__modes">
        <Button
          variant={mode === 'edit' ? 'outline' : 'ghost'}
          size="sm"
          onClick={() => onModeChange('edit')}
          className="markdown-toolbar__mode-btn"
        >
          <Pencil className="markdown-toolbar__mode-icon" />
          Edit
        </Button>
        <Button
          variant={mode === 'preview' ? 'outline' : 'ghost'}
          size="sm"
          onClick={() => onModeChange('preview')}
          className="markdown-toolbar__mode-btn"
        >
          <Eye className="markdown-toolbar__mode-icon" />
          Preview
        </Button>
      </div>
    </div>
  )
}
