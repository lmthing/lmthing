import { useCallback, useMemo } from 'react'
import { useToggle, useSpaceFS, useGlob, useUIState, serializeKnowledgeFieldIndex } from '@lmthing/state'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Heading } from '@lmthing/ui/elements/typography/heading'
import { Caption } from '@lmthing/ui/elements/typography/caption'
import { Label } from '@lmthing/ui/elements/typography/label'
import { Card, CardBody } from '@lmthing/ui/elements/content/card'
import { Stack } from '@lmthing/ui/elements/layouts/stack'
import { Button } from '@lmthing/ui/elements/forms/button'
import { Input } from '@lmthing/ui/elements/forms/input'
import { buildSpacePathFromParams } from '@/lib/space-url'
import { Plus, X } from 'lucide-react'

interface FieldEntry {
  domain: string
  field: string
  fieldId: string // encoded as domain---field
}

function FieldCard({ entry, spacePath }: { entry: FieldEntry; spacePath: string }) {
  const navigate = useNavigate()
  return (
    <Card
      interactive
      onClick={() => navigate({ to: `${spacePath}/knowledge/${encodeURIComponent(entry.fieldId)}` })}
      style={{ cursor: 'pointer' }}
    >
      <CardBody>
        <Stack row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Label>{entry.field}</Label>
            <Caption muted style={{ marginTop: '0.125rem' }}>
              {entry.domain} / {entry.field}
            </Caption>
          </div>
        </Stack>
      </CardBody>
    </Card>
  )
}

function KnowledgePage() {
  const params = Route.useParams()
  const { username, studioId, storageId, spaceId } = params
  const spaceFS = useSpaceFS()
  const navigate = useNavigate()
  const indexPaths = useGlob('knowledge/*/*/index.md')
  const [showCreate, , setShowCreate] = useToggle('knowledge-page.show-create', false)

  const [newDomain, setNewDomain] = useUIState<string>('knowledge-page.new-domain', '')
  const [newField, setNewField] = useUIState<string>('knowledge-page.new-field', '')

  const spacePath = buildSpacePathFromParams(username, studioId, storageId, spaceId)

  // Parse domain+field from index paths and group by domain
  const { entries, byDomain, domains } = useMemo(() => {
    const entries: FieldEntry[] = indexPaths.map(p => {
      const parts = p.split('/')
      const domain = parts[1]
      const field = parts[2]
      return { domain, field, fieldId: `${domain}---${field}` }
    }).sort((a, b) => a.domain.localeCompare(b.domain) || a.field.localeCompare(b.field))

    const byDomain = new Map<string, FieldEntry[]>()
    for (const e of entries) {
      if (!byDomain.has(e.domain)) byDomain.set(e.domain, [])
      byDomain.get(e.domain)!.push(e)
    }
    const domains = Array.from(byDomain.keys()).sort()

    return { entries, byDomain, domains }
  }, [indexPaths])

  const handleCreateField = useCallback(() => {
    if (!spaceFS || !newDomain.trim() || !newField.trim()) return
    const domain = newDomain.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')
    const field = newField.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')
    const variable = field.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
    const content = serializeKnowledgeFieldIndex(
      { type: 'string', variable },
      ''
    )
    spaceFS.writeFile(`knowledge/${domain}/${field}/index.md`, content)
    setNewDomain('')
    setNewField('')
    setShowCreate(false)
    navigate({ to: `${spacePath}/knowledge/${encodeURIComponent(`${domain}---${field}`)}` })
  }, [spaceFS, newDomain, newField, spacePath, navigate])

  return (
    <div style={{ maxWidth: '48rem', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <Stack gap="lg">
        <Stack row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Heading level={2}>Knowledge</Heading>
            <Caption muted>
              {entries.length} knowledge field{entries.length !== 1 ? 's' : ''} configured.
            </Caption>
          </div>
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            <Plus style={{ width: '1rem', height: '1rem', marginRight: '0.25rem' }} />
            New Field
          </Button>
        </Stack>

        {showCreate && (
          <Card>
            <CardBody>
              <Stack gap="sm">
                <Stack row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <Heading level={4}>New Knowledge Field</Heading>
                  <Button variant="ghost" size="icon" onClick={() => setShowCreate(false)}>
                    <X style={{ width: '1rem', height: '1rem' }} />
                  </Button>
                </Stack>
                <div>
                  <Label compact>Domain</Label>
                  <Input
                    type="text"
                    value={newDomain}
                    onChange={e => setNewDomain(e.target.value)}
                    placeholder="e.g. style, tone, audience"
                    autoFocus
                  />
                  <Caption muted>Groups related fields together</Caption>
                </div>
                <div>
                  <Label compact>Field</Label>
                  <Input
                    type="text"
                    value={newField}
                    onChange={e => setNewField(e.target.value)}
                    placeholder="e.g. writing-style, grade-level"
                    onKeyDown={e => { if (e.key === 'Enter') handleCreateField() }}
                  />
                </div>
                <Stack row gap="sm">
                  <Button variant="primary" size="sm" onClick={handleCreateField} disabled={!newDomain.trim() || !newField.trim()}>
                    Create Field
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
                    Cancel
                  </Button>
                </Stack>
              </Stack>
            </CardBody>
          </Card>
        )}

        {entries.length === 0 && !showCreate ? (
          <Caption muted>No knowledge fields yet. Create one to get started.</Caption>
        ) : (
          <Stack gap="lg">
            {domains.map(domain => (
              <div key={domain}>
                <Heading level={4} style={{ marginBottom: '0.5rem', color: 'var(--color-muted-foreground)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {domain}
                </Heading>
                <Stack gap="sm">
                  {(byDomain.get(domain) || []).map(entry => (
                    <FieldCard key={entry.fieldId} entry={entry} spacePath={spacePath} />
                  ))}
                </Stack>
              </div>
            ))}
          </Stack>
        )}
      </Stack>
    </div>
  )
}

export const Route = createFileRoute(
  '/$username/$studioId/$storageId/$spaceId/knowledge/',
)({
  component: KnowledgePage,
})
