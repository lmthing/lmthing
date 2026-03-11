import { useMemo, type ReactNode } from 'react'
import { useToggle } from '@lmthing/state'
import { JsonView } from 'react-json-view-lite'
import 'react-json-view-lite/dist/index.css'
import {
  ChevronDown,
  ChevronRight,
  Eye,
  RefreshCw,
  Package,
  Bot,
  Workflow,
  Trash2,
  FileText,
  FolderTree,
  Copy,
  Pencil,
  Lock,
  ArrowRightLeft,
  Plus,
  Wrench,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ParsedToolCall {
  name: string
  args: unknown
  result: unknown
  isOk: boolean
}

/* ------------------------------------------------------------------ */
/*  Tool metadata                                                      */
/* ------------------------------------------------------------------ */

type ToolMeta = {
  icon: ReactNode
  gradient: string
  glow: string
  label: string
  category: 'inspect' | 'workspace' | 'agent' | 'flow' | 'knowledge' | 'env' | 'misc'
}

const CATEGORY_RING: Record<ToolMeta['category'], string> = {
  inspect: 'ring-brand-1/30',
  workspace: 'ring-brand-2/30',
  agent: 'ring-brand-3/30',
  flow: 'ring-brand-2/30',
  knowledge: 'ring-brand-4/30',
  env: 'ring-brand-1/30',
  misc: 'ring-neutral/30',
}

const iconSize = 'h-3.5 w-3.5'

const TOOL_META: Record<string, ToolMeta> = {
  viewWorkspaceData: { icon: <Eye className={iconSize} />, gradient: 'from-brand-1 to-brand-2', glow: 'shadow-brand-1/20', label: 'View Data', category: 'inspect' },
  listWorkspaceRoots: { icon: <FolderTree className={iconSize} />, gradient: 'from-brand-1 to-brand-2', glow: 'shadow-brand-1/20', label: 'List Roots', category: 'inspect' },
  listChildren: { icon: <FolderTree className={iconSize} />, gradient: 'from-brand-1 to-brand-2', glow: 'shadow-brand-1/20', label: 'List Children', category: 'inspect' },
  searchWorkspace: { icon: <Eye className={iconSize} />, gradient: 'from-brand-1 to-brand-2', glow: 'shadow-brand-1/20', label: 'Search Workspace', category: 'inspect' },
  getEntity: { icon: <Eye className={iconSize} />, gradient: 'from-brand-1 to-brand-2', glow: 'shadow-brand-1/20', label: 'Get Entity', category: 'inspect' },
  resolveReference: { icon: <ArrowRightLeft className={iconSize} />, gradient: 'from-brand-1 to-brand-3', glow: 'shadow-brand-1/20', label: 'Resolve Ref', category: 'inspect' },
  findBacklinks: { icon: <ArrowRightLeft className={iconSize} />, gradient: 'from-brand-1 to-brand-3', glow: 'shadow-brand-1/20', label: 'Find Backlinks', category: 'inspect' },
  getBreadcrumbs: { icon: <ChevronRight className={iconSize} />, gradient: 'from-brand-1 to-brand-2', glow: 'shadow-brand-1/20', label: 'Breadcrumbs', category: 'inspect' },
  recentlyTouched: { icon: <RefreshCw className={iconSize} />, gradient: 'from-brand-1 to-brand-2', glow: 'shadow-brand-1/20', label: 'Recently Touched', category: 'inspect' },
  snapshotWorkspace: { icon: <Copy className={iconSize} />, gradient: 'from-brand-1 to-brand-3', glow: 'shadow-brand-1/20', label: 'Snapshot', category: 'inspect' },
  diffSnapshots: { icon: <ArrowRightLeft className={iconSize} />, gradient: 'from-brand-1 to-brand-3', glow: 'shadow-brand-1/20', label: 'Diff Snapshots', category: 'inspect' },
  suggestNextNavigation: { icon: <Wrench className={iconSize} />, gradient: 'from-brand-1 to-brand-3', glow: 'shadow-brand-1/20', label: 'Suggest Navigation', category: 'inspect' },
  setCurrentWorkspace: { icon: <ArrowRightLeft className={iconSize} />, gradient: 'from-brand-2 to-brand-3', glow: 'shadow-brand-2/20', label: 'Switch Workspace', category: 'workspace' },
  createWorkspace: { icon: <Plus className={iconSize} />, gradient: 'from-brand-2 to-brand-1', glow: 'shadow-brand-2/20', label: 'Create Workspace', category: 'workspace' },
  reload: { icon: <RefreshCw className={iconSize} />, gradient: 'from-brand-2 to-brand-1', glow: 'shadow-brand-2/20', label: 'Reload', category: 'workspace' },
  updatePackageJson: { icon: <Package className={iconSize} />, gradient: 'from-brand-2 to-brand-3', glow: 'shadow-brand-2/20', label: 'Update Package', category: 'workspace' },
  upsertAgent: { icon: <Bot className={iconSize} />, gradient: 'from-brand-3 to-brand-4', glow: 'shadow-brand-3/20', label: 'Upsert Agent', category: 'agent' },
  deleteAgent: { icon: <Trash2 className={iconSize} />, gradient: 'from-brand-3 to-brand-4', glow: 'shadow-brand-3/20', label: 'Delete Agent', category: 'agent' },
  upsertFlow: { icon: <Workflow className={iconSize} />, gradient: 'from-brand-2 to-brand-2', glow: 'shadow-brand-3/20', label: 'Upsert Flow', category: 'flow' },
  deleteFlow: { icon: <Trash2 className={iconSize} />, gradient: 'from-brand-3 to-brand-4', glow: 'shadow-brand-3/20', label: 'Delete Flow', category: 'flow' },
  upsertEnvFile: { icon: <Lock className={iconSize} />, gradient: 'from-brand-1 to-brand-2', glow: 'shadow-brand-1/20', label: 'Upsert Env', category: 'env' },
  deleteEnvFile: { icon: <Trash2 className={iconSize} />, gradient: 'from-brand-1 to-brand-4', glow: 'shadow-brand-1/20', label: 'Delete Env', category: 'env' },
  updateKnowledgeFileContent: { icon: <FileText className={iconSize} />, gradient: 'from-brand-4 to-brand-3', glow: 'shadow-brand-4/20', label: 'Update File Content', category: 'knowledge' },
  updateKnowledgeFileFrontmatter: { icon: <Pencil className={iconSize} />, gradient: 'from-brand-4 to-brand-3', glow: 'shadow-brand-4/20', label: 'Update Frontmatter', category: 'knowledge' },
  updateKnowledgeDirectoryConfig: { icon: <FolderTree className={iconSize} />, gradient: 'from-brand-4 to-brand-3', glow: 'shadow-brand-4/20', label: 'Update Dir Config', category: 'knowledge' },
  addKnowledgeNode: { icon: <Plus className={iconSize} />, gradient: 'from-brand-4 to-brand-3', glow: 'shadow-brand-4/20', label: 'Add Node', category: 'knowledge' },
  updateKnowledgeNodePath: { icon: <ArrowRightLeft className={iconSize} />, gradient: 'from-brand-4 to-brand-2', glow: 'shadow-brand-4/20', label: 'Move Node', category: 'knowledge' },
  deleteKnowledgeNode: { icon: <Trash2 className={iconSize} />, gradient: 'from-brand-4 to-destructive', glow: 'shadow-brand-4/20', label: 'Delete Node', category: 'knowledge' },
  duplicateKnowledgeNode: { icon: <Copy className={iconSize} />, gradient: 'from-brand-4 to-brand-3', glow: 'shadow-brand-4/20', label: 'Duplicate Node', category: 'knowledge' },
}

const DEFAULT_TOOL_META: ToolMeta = {
  icon: <Wrench className={iconSize} />,
  gradient: 'from-neutral to-neutral',
  glow: 'shadow-neutral/20',
  label: 'Tool',
  category: 'misc',
}

function getToolMeta(name: string): ToolMeta {
  return TOOL_META[name] ?? DEFAULT_TOOL_META
}

/* ------------------------------------------------------------------ */
/*  Parsing                                                           */
/* ------------------------------------------------------------------ */

const TOOL_BLOCK_RE =
  /🔧\s*(\S+)\n⤷\s*args:\s*([\s\S]*?)(?=\n⤷\s*result:)\n⤷\s*result:\s*([\s\S]*?)(?=\n\n🔧|\s*$)/g

const TOOL_EVENT_BLOCK_RE = /\[\[THING_TOOL_EVENT\]\]\n?([\s\S]*?)\n?\[\[\/THING_TOOL_EVENT\]\]/g

function parseJsonValue(raw: string): unknown {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  try { return JSON.parse(trimmed) } catch { return trimmed }
}

function parseToolBlock(blockText: string): ParsedToolCall | null {
  const match = blockText.match(/🔧\s*(\S+)\n⤷\s*args:\s*([\s\S]*?)\n⤷\s*result:\s*([\s\S]*)$/)
  if (!match) return null
  const resultValue = parseJsonValue(match[3])
  const isOk = typeof resultValue === 'object' && resultValue !== null
    && 'ok' in (resultValue as Record<string, unknown>)
    && Boolean((resultValue as Record<string, unknown>).ok)
  return { name: match[1], args: parseJsonValue(match[2]), result: resultValue, isOk }
}

function parseToolCalls(text: string): { toolCalls: ParsedToolCall[]; textParts: string[] } {
  const toolCalls: ParsedToolCall[] = []
  const textParts: string[] = []
  let hasTaggedBlocks = false

  TOOL_EVENT_BLOCK_RE.lastIndex = 0
  let taggedLastIndex = 0
  let taggedMatch = TOOL_EVENT_BLOCK_RE.exec(text)

  while (taggedMatch !== null) {
    hasTaggedBlocks = true
    const before = text.slice(taggedLastIndex, taggedMatch.index).trim()
    if (before) textParts.push(before)
    const blockContent = taggedMatch[1].trim()
    const parsedCall = parseToolBlock(blockContent)
    if (parsedCall) { toolCalls.push(parsedCall); textParts.push(`__TOOL_CALL_${toolCalls.length - 1}__`) }
    else if (blockContent) textParts.push(blockContent)
    taggedLastIndex = taggedMatch.index + taggedMatch[0].length
    taggedMatch = TOOL_EVENT_BLOCK_RE.exec(text)
  }

  if (hasTaggedBlocks) {
    const after = text.slice(taggedLastIndex).trim()
    if (after) textParts.push(after)
    return { toolCalls, textParts }
  }

  let lastIndex = 0
  TOOL_BLOCK_RE.lastIndex = 0
  let match: RegExpExecArray | null = TOOL_BLOCK_RE.exec(text)
  while (match !== null) {
    const before = text.slice(lastIndex, match.index).trim()
    if (before) textParts.push(before)
    const resultStr = match[3].trim()
    const resultValue = parseJsonValue(resultStr)
    const isOk = typeof resultValue === 'object' && resultValue !== null
      && 'ok' in (resultValue as Record<string, unknown>)
      && Boolean((resultValue as Record<string, unknown>).ok)
    toolCalls.push({ name: match[1], args: parseJsonValue(match[2].trim()), result: resultValue, isOk })
    textParts.push(`__TOOL_CALL_${toolCalls.length - 1}__`)
    lastIndex = match.index + match[0].length
    match = TOOL_BLOCK_RE.exec(text)
  }

  const after = text.slice(lastIndex).trim()
  if (after) textParts.push(after)
  return { toolCalls, textParts }
}

/* ------------------------------------------------------------------ */
/*  JSON pretty-printer                                                */
/* ------------------------------------------------------------------ */

function JsonSyntax({ value }: { value: unknown }) {
  if (typeof value === 'string') {
    return (
      <pre className="max-h-52 overflow-auto rounded-md bg-foreground/80 p-2.5 text-[11px] leading-relaxed text-muted-foreground scrollbar-thin font-mono whitespace-pre-wrap break-words">
        {value}
      </pre>
    )
  }
  const jsonData = (value !== null && typeof value === 'object') ? value as Record<string, unknown> | unknown[] : { value }
  return (
    <div className="max-h-52 overflow-auto rounded-md border border-border/70 bg-background p-2.5 text-[11px]">
      <JsonView data={jsonData} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Collapsible section                                                */
/* ------------------------------------------------------------------ */

function CollapsibleSection({ label, children, defaultOpen = false, accentColor }: {
  label: string; children: ReactNode; defaultOpen?: boolean; accentColor?: string
}) {
  const [open, toggle] = useToggle(`tool-call-display.collapsible-${label}`, defaultOpen)
  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => toggle()}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
          'text-muted-foreground hover:text-foreground hover:bg-muted',
        )}
      >
        {open ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
        <span>{label}</span>
        {accentColor && <span className={cn('ml-auto h-1.5 w-1.5 rounded-full', accentColor)} />}
      </button>
      {open && <div className="mt-1 animate-fade-in">{children}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Tool call card                                                     */
/* ------------------------------------------------------------------ */

function ToolCallCard({ call, index, total }: { call: ParsedToolCall; index: number; total: number }) {
  const meta = getToolMeta(call.name)
  const categoryRing = CATEGORY_RING[meta.category]

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-lg border transition-all duration-300',
        'border-border/80',
        'hover:border-border',
        'bg-card',
        'ring-1', categoryRing, 'animate-fade-in',
      )}
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'backwards' }}
    >
      <div className={cn('absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r opacity-80 group-hover:opacity-100 transition-opacity', meta.gradient)} />
      <div className="flex items-center gap-2.5 px-3 pt-3 pb-1.5">
        <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-primary-foreground shadow-md', meta.gradient, meta.glow)}>
          {meta.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[12px] font-semibold text-foreground">{meta.label}</span>
            {total > 1 && (
              <span className="shrink-0 rounded-full bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                {index + 1}/{total}
              </span>
            )}
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">{call.name}</span>
        </div>
        <div className="shrink-0">
          {call.isOk ? (
            <div className="flex items-center gap-1 rounded-full bg-brand-2/10 px-2 py-0.5">
              <CheckCircle2 className="h-3 w-3 text-brand-2" />
              <span className="text-[10px] font-semibold text-brand-2">OK</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 rounded-full bg-brand-4/10 px-2 py-0.5">
              <XCircle className="h-3 w-3 text-brand-4" />
              <span className="text-[10px] font-semibold text-brand-4">ERR</span>
            </div>
          )}
        </div>
      </div>
      <div className="px-3 pb-2.5">
        <CollapsibleSection label="Arguments" accentColor="bg-brand-3">
          <JsonSyntax value={call.args} />
        </CollapsibleSection>
        <CollapsibleSection label="Result" defaultOpen accentColor="bg-brand-2">
          <JsonSyntax value={call.result} />
        </CollapsibleSection>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Running pill                                                       */
/* ------------------------------------------------------------------ */

export function ToolRunningPill({ text }: { text: string }) {
  const toolNames = useMemo(() => {
    const match = text.match(/🔧\s*Running tools?:?\s*(.+)/i)
    if (!match) return []
    return match[1].split(',').map((name) => name.trim()).filter(Boolean)
  }, [text])

  if (toolNames.length === 0) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-gradient-to-r from-muted to-muted px-3 py-1.5">
        <div className="flex gap-0.5">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-3" style={{ animationDelay: '0ms' }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-3" style={{ animationDelay: '150ms' }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-3" style={{ animationDelay: '300ms' }} />
        </div>
        <span className="text-[11px] font-medium text-muted-foreground">Running tool…</span>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {toolNames.map((name) => {
        const meta = getToolMeta(name)
        return (
          <div key={name} className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1', 'border-border/80 bg-card', 'ring-1', CATEGORY_RING[meta.category])}>
            <div className={cn('flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br text-primary-foreground', meta.gradient)}>{meta.icon}</div>
            <span className="text-[11px] font-medium text-foreground">{meta.label}</span>
            <div className="flex gap-0.5">
              <span className="h-1 w-1 animate-bounce rounded-full bg-neutral" style={{ animationDelay: '0ms' }} />
              <span className="h-1 w-1 animate-bounce rounded-full bg-neutral" style={{ animationDelay: '150ms' }} />
              <span className="h-1 w-1 animate-bounce rounded-full bg-neutral" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function ToolCallDisplay({ content }: { content: string }) {
  const { toolCalls, textParts } = useMemo(() => parseToolCalls(content), [content])

  if (toolCalls.length === 0) {
    return <p className="whitespace-pre-wrap break-words">{content}</p>
  }

  return (
    <div className="space-y-2">
      {textParts.map((part, index) => {
        const toolMatch = part.match(/^__TOOL_CALL_(\d+)__$/)
        if (toolMatch) {
          const callIndex = parseInt(toolMatch[1], 10)
          const call = toolCalls[callIndex]
          if (!call) return null
          return <ToolCallCard key={`tool-${callIndex}`} call={call} index={callIndex} total={toolCalls.length} />
        }
        if (/^🔧\s*Running tool/i.test(part)) {
          return <ToolRunningPill key={`running-${index}`} text={part} />
        }
        return <p key={`text-${index}`} className="whitespace-pre-wrap break-words">{part}</p>
      })}
    </div>
  )
}
