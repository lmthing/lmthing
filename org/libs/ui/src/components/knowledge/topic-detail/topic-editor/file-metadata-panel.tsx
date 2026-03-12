import { useEffect, useCallback } from 'react'
import { useSpaceFS } from '@lmthing/state'
import { parseFrontmatter, serializeFrontmatter } from '@lmthing/state'
import { useUIState } from '@lmthing/state'
import { useFile } from '@lmthing/ui/hooks/fs/useFile'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Input } from '@lmthing/ui/elements/forms/input'
import { Button } from '@lmthing/ui/elements/forms/button'

interface FileMetadataPanelProps {
  topicPath: string
}

interface Metadata {
  title?: string
  category?: string
  tags?: string[]
  author?: string
  [key: string]: unknown
}

export function FileMetadataPanel({ topicPath }: FileMetadataPanelProps) {
  const spaceFS = useSpaceFS()
  const rawContent = useFile(topicPath)

  const [title, setTitle] = useUIState<string>('file-metadata-panel.title', '')
  const [category, setCategory] = useUIState<string>('file-metadata-panel.category', '')
  const [tags, setTags] = useUIState<string>('file-metadata-panel.tags', '')
  const [author, setAuthor] = useUIState<string>('file-metadata-panel.author', '')
  const [isDirty, setIsDirty] = useUIState<boolean>('file-metadata-panel.is-dirty', false)

  useEffect(() => {
    if (rawContent === null || rawContent === undefined) return
    const { frontmatter } = parseFrontmatter<Metadata>(rawContent)
    setTitle(frontmatter.title || '')
    setCategory(frontmatter.category || '')
    setTags(Array.isArray(frontmatter.tags) ? frontmatter.tags.join(', ') : '')
    setAuthor(frontmatter.author || '')
    setIsDirty(false)
  }, [rawContent])

  const handleChange = useCallback((setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value)
    setIsDirty(true)
  }, [])

  const handleSave = useCallback(() => {
    if (!spaceFS || !rawContent) return

    const { frontmatter, content } = parseFrontmatter<Metadata>(rawContent)
    const updated: Metadata = {
      ...frontmatter,
      ...(title && { title }),
      ...(category && { category }),
      ...(tags && { tags: tags.split(',').map(t => t.trim()).filter(Boolean) }),
      ...(author && { author }),
    }

    // Remove empty keys
    if (!title) delete updated.title
    if (!category) delete updated.category
    if (!tags) delete updated.tags
    if (!author) delete updated.author

    const hasAnyFrontmatter = Object.keys(updated).length > 0
    const newContent = hasAnyFrontmatter
      ? serializeFrontmatter(updated, content)
      : content

    spaceFS.writeFile(topicPath, newContent)
    setIsDirty(false)
  }, [spaceFS, topicPath, rawContent, title, category, tags, author])

  const filename = topicPath.split('/').pop() || ''

  return (
    <div style={{
      borderBottom: '1px solid var(--color-border)',
      padding: '0.75rem 1rem',
      backgroundColor: 'var(--color-muted)',
    }}>
      <Stack gap="sm">
        <div>
          <Label compact>Filename</Label>
          <Caption muted>{filename}</Caption>
        </div>

        <div>
          <Label compact>Title</Label>
          <Input type="text" value={title} onChange={handleChange(setTitle)} placeholder="Document title" />
        </div>

        <div>
          <Label compact>Category</Label>
          <Input type="text" value={category} onChange={handleChange(setCategory)} placeholder="e.g. guides, reference" />
        </div>

        <div>
          <Label compact>Tags</Label>
          <Input type="text" value={tags} onChange={handleChange(setTags)} placeholder="tag1, tag2, tag3" />
        </div>

        <div>
          <Label compact>Author</Label>
          <Input type="text" value={author} onChange={handleChange(setAuthor)} placeholder="Author name" />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="primary" size="sm" disabled={!isDirty} onClick={handleSave}>
            Save Metadata
          </Button>
        </div>
      </Stack>
    </div>
  )
}
