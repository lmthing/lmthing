import { useEffect, useCallback } from 'react'
import {
  useUIState,
  useSpaceFS,
  useKnowledgeDomainIndex,
  serializeKnowledgeDomainIndex,
  P,
} from '@lmthing/state'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Input } from '@lmthing/ui/elements/forms/input'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Textarea } from '@lmthing/ui/elements/forms/textarea'
import { BookOpen } from 'lucide-react'
import '@lmthing/css/components/knowledge/index.css'

export interface DomainMetadataPanelProps {
  domain: string
}

const RENDER_AS_OPTIONS = [
  { value: '', label: '— none (use default) —' },
  { value: 'tabs', label: 'Tabs' },
  { value: 'list', label: 'List' },
] as const

export function DomainMetadataPanel({ domain }: DomainMetadataPanelProps) {
  const spaceFS = useSpaceFS()
  const indexPath = P.knowledgeDomainIndex(domain)
  const parsed = useKnowledgeDomainIndex(domain)

  const [domainLabel, setDomainLabel] = useUIState<string>('domain-metadata-panel.label', '')
  const [icon, setIcon] = useUIState<string>('domain-metadata-panel.icon', '')
  const [color, setColor] = useUIState<string>('domain-metadata-panel.color', '')
  const [renderAs, setRenderAs] = useUIState<string>('domain-metadata-panel.render-as', '')
  const [description, setDescription] = useUIState<string>('domain-metadata-panel.description', '')
  const [isDirty, setIsDirty] = useUIState<boolean>('domain-metadata-panel.is-dirty', false)

  useEffect(() => {
    if (!parsed) return
    setDomainLabel(parsed.label || '')
    setIcon(parsed.icon || '')
    setColor(parsed.color || '')
    setRenderAs(parsed.renderAs || '')
    setDescription(parsed.description || '')
    setIsDirty(false)
  }, [parsed])

  const markDirty = useCallback(() => setIsDirty(true), [])

  const handleSave = useCallback(() => {
    if (!spaceFS) return
    const content = serializeKnowledgeDomainIndex(
      {
        ...(domainLabel ? { label: domainLabel } : {}),
        ...(icon ? { icon } : {}),
        ...(color ? { color } : {}),
        ...(renderAs === 'tabs' || renderAs === 'list' ? { renderAs: renderAs as 'tabs' | 'list' } : {}),
      },
      description
    )
    spaceFS.writeFile(indexPath, content)
    setIsDirty(false)
  }, [spaceFS, indexPath, domainLabel, icon, color, renderAs, description])

  return (
    <div className="dir-metadata">
      <Stack gap="md">
        <Stack row className="dir-metadata__header">
          <BookOpen className="dir-metadata__icon" />
          <div>
            <Heading level={3}>{domain}</Heading>
            <Caption muted>{indexPath}</Caption>
          </div>
        </Stack>

        <div>
          <Label compact>Label</Label>
          <Input
            type="text"
            value={domainLabel}
            onChange={e => { setDomainLabel(e.target.value); markDirty() }}
            placeholder="Human-readable domain name (optional)"
          />
        </div>

        <div>
          <Label compact>Icon</Label>
          <Input
            type="text"
            value={icon}
            onChange={e => { setIcon(e.target.value); markDirty() }}
            placeholder="Emoji or icon name (optional)"
          />
        </div>

        <div>
          <Label compact>Color</Label>
          <Input
            type="text"
            value={color}
            onChange={e => { setColor(e.target.value); markDirty() }}
            placeholder="CSS color or token (optional)"
          />
        </div>

        <div>
          <Label compact>Render As</Label>
          <select
            className="input"
            value={renderAs}
            onChange={e => { setRenderAs(e.target.value); markDirty() }}
          >
            {RENDER_AS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <Caption muted>Studio UI hint: how to display this domain's fields.</Caption>
        </div>

        <div>
          <Label compact>Description</Label>
          <Textarea
            value={description}
            onChange={e => { setDescription(e.target.value); markDirty() }}
            placeholder="Describe this knowledge domain..."
            compact
          />
          <Caption muted>Injected into the agent system prompt when this domain is referenced.</Caption>
        </div>

        <div className="dir-metadata__footer">
          <Button variant="primary" size="sm" disabled={!isDirty} onClick={handleSave}>
            Save
          </Button>
        </div>
      </Stack>
    </div>
  )
}
