import '@lmthing/css/components/agent/runtime/index.css'
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
  gradientClass: string
  glowClass: string
  label: string
  category: 'inspect' | 'workspace' | 'agent' | 'flow' | 'knowledge' | 'env' | 'misc'
}

const CATEGORY_RING_CLASS: Record<ToolMeta['category'], string> = {
  inspect: 'tool-call-card--ring-inspect',
  workspace: 'tool-call-card--ring-workspace',
  agent: 'tool-call-card--ring-agent',
  flow: 'tool-call-card--ring-flow',
  knowledge: 'tool-call-card--ring-knowledge',
  env: 'tool-call-card--ring-env',
  misc: 'tool-call-card--ring-misc',
}

const iconClass = 'tool-call-card__icon-inner'

const TOOL_META: Record<string, ToolMeta> = {
  viewWorkspaceData: { icon: <Eye className={iconClass} />, gradientClass: 'tool-call-card__gradient--brand-1-2', glowClass: 'tool-call-card__glow--brand-1', label: 'View Data', category: 'inspect' },
  listWorkspaceRoots: { icon: <FolderTree className={iconClass} />, gradientClass: 'tool-call-card__gradient--brand-1-2', glowClass: 'tool-call-card__glow--brand-1', label: 'List Roots', category: 'inspect' },
  listChildren: { icon: <FolderTree className={iconClass} />, gradientClass: 'tool-call-card__gradient--brand-1-2', glowClass: 'tool-call-card__glow--brand-1', label: 'List Children', category: 'inspect' },
  searchWorkspace: { icon: <Eye className={iconClass} />, gradientClass: 'tool-call-card__gradient--brand-1-2', glowClass: 'tool-call-card__glow--brand-1', label: 'Search Workspace', category: 'inspect' },
  getEntity: { icon: <Eye className={iconClass} />, gradientClass: 'tool-call-card__gradient--brand-1-2', glowClass: 'tool-call-card__glow--brand-1', label: 'Get Entity', category: 'inspect' },
  resolveReference: { icon: <ArrowRightLeft className={iconClass} />, gradientClass: 'tool-call-card__gradient--brand-1-3', glowClass: 'tool-call-card__glow--brand-1', label: 'Resolve Ref', category: 'inspect' },
  findBacklinks: { icon: <ArrowRightLeft className={iconClass} />, gradientClass: 'tool-call-card__gradient--brand-1-3', glowClass: 'tool-call-card__glow--brand-1', label: 'Find Backlinks', category: 'inspect' },
  getBreadcrumbs: { icon: <ChevronRight className={iconClass} />, gradientClass: 'tool-call-card__gradient--brand-1-2', glowClass: 'tool-call-card__glow--brand-1', label: 'Breadcrumbs', category: 'inspect' },
  recentlyTouched: { icon: <RefreshCw className={iconClass} />, gradientClass: 'tool-call-card__gradient--brand-1-2', glowClass: 'tool-call-card__glow--brand-1', label: 'Recently Touched', category: 'inspect' },
  snapshotWorkspace: { icon: <Copy className={iconClass} />, gradientClass: 'tool-call-card__gradient--brand-1-3', glowClass: 'tool-call-card__glow--brand-1', label: 'Snapshot', category: 'inspect' },
  diffSnapshots: { icon: <ArrowRightLeft className={iconClass} />, gradientClass: 'tool-call-card__gradient--brand-1-3', glowClass: 'tool-call-card__glow--brand-1', label: 'Diff Snapshots', category: 'inspect' },
  suggestNextNavigation: { icon: <Wrench className={iconClass} />, gradientClass: 'tool-call-card__gradient--brand-1-3', glowClass: 'tool-call-card__glow--brand-1', label: 'Suggest Navigation', category: 'inspect' },
  setCurrentWorkspace: { icon: <ArrowRightLeft className={iconClass} />, gradientClass: 'tool-call-card__gradient--brand-2-3', glowClass: 'tool-call-card__glow--brand-2', label: 'Switch Workspace', category: 'workspace' },
  createWorkspace: { icon: <Plus className={iconClass} />, gradientClass: 'tool-call-card__gradient--brand-2-1', glowClass: 'tool-call-card__glow--brand-2', label: 'Create Workspace', category: 'workspace' },
  reload: { icon: <RefreshCw className={iconClass} />, gradientClass: 'tool-call-card__gradient--brand-2-1', glowClass: 'tool-call-card__glow--brand-2', label: 'Reload', category: 'workspace' },
  updatePackageJson: { icon: <Package className={iconClass} />, gradientClass: 'tool-call-card__gradient--brand-2-3', glowClass: 'tool-call-card__glow--brand-2', label: 'Update Package', category: 'workspace' },
  upsertAgent: { icon: <Bot className={iconClass} />, gradientClass: 'tool-call-card__gradient--brand-3-4', glowClass: 'tool-call-card__glow--brand-3', label: 'Upsert Agent', category: 'agent' },
  deleteAgent: { icon: <Trash2 className={iconClass} />, gradientClass: 'tool-call-card__gradient--brand-3-4', glowClass: 'tool-call-card__glow--brand-3', label: 'Delete Agent', category: 'agent' },
  upsertFlow: { icon: <Workflow className={iconClass} />, gradientClass: 'tool-call-card__gradient--brand-2-2', glowClass: 'tool-call-card__glow--brand-3', label: 'Upsert Flow', category: 'flow' },
  deleteFlow: { icon: <Trash2 className={iconClass} />, gradientClass: 'tool-call-card__gradient--brand-3-4', glowClass: 'tool-call-card__glow--brand-3', label: 'Delete Flow', category: 'flow' },
  upsertEnvFile: { icon: <Lock className={iconClass} />, gradientClass: 'tool-call-card__gradient--brand-1-2', glowClass: 'tool-call-card__glow--brand-1', label: 'Upsert Env', category: 'env' },
  deleteEnvFile: { icon: <Trash2 className={iconClass} />, gradientClass: 'tool-call-card__gradient--brand-1-3', glowClass: 'tool-call-card__glow--brand-1', label: 'Delete Env', category: 'env' },
  updateKnowledgeFileContent: { icon: <FileText className={iconClass} />, gradientClass: 'tool-call-card__gradient--brand-4-3', glowClass: 'tool-call-card__glow--brand-4', label: 'Update File Content', category: 'knowledge' },
  updateKnowledgeFileFrontmatter: { icon: <Pencil className={iconClass} />, gradientClass: 'tool-call-card__gradient--brand-4-3', glowClass: 'tool-call-card__glow--brand-4', label: 'Update Frontmatter', category: 'knowledge' },
  updateKnowledgeDirectoryConfig: { icon: <FolderTree className={iconClass} />, gradientClass: 'tool-call-card__gradient--brand-4-3', glowClass: 'tool-call-card__glow--brand-4', label: 'Update Dir Config', category: 'knowledge' },
  addKnowledgeNode: { icon: <Plus className={iconClass} />, gradientClass: 'tool-call-card__gradient--brand-4-3', glowClass: 'tool-call-card__glow--brand-4', label: 'Add Node', category: 'knowledge' },
  updateKnowledgeNodePath: { icon: <ArrowRightLeft className={iconClass} />, gradientClass: 'tool-call-card__gradient--brand-4-2', glowClass: 'tool-call-card__glow--brand-4', label: 'Move Node', category: 'knowledge' },
  deleteKnowledgeNode: { icon: <Trash2 className={iconClass} />, gradientClass: 'tool-call-card__gradient--brand-4-destructive', glowClass: 'tool-call-card__glow--brand-4', label: 'Delete Node', category: 'knowledge' },
  duplicateKnowledgeNode: { icon: <Copy className={iconClass} />, gradientClass: 'tool-call-card__gradient--brand-4-3', glowClass: 'tool-call-card__glow--brand-4', label: 'Duplicate Node', category: 'knowledge' },
}

const DEFAULT_TOOL_META: ToolMeta = {
  icon: <Wrench className={iconClass} />,
  gradientClass: 'tool-call-card__gradient--neutral',
  glowClass: 'tool-call-card__glow--neutral',
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
      <pre className="tool-call-display__json-text">
        {value}
      </pre>
    )
  }
  const jsonData = (value !== null && typeof value === 'object') ? value as Record<string, unknown> | unknown[] : { value }
  return (
    <div className="tool-call-display__json-tree">
      <JsonView data={jsonData} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Collapsible section                                                */
/* ------------------------------------------------------------------ */

function CollapsibleSection({ label, children, defaultOpen = false, dotVariant }: {
  label: string; children: ReactNode; defaultOpen?: boolean; dotVariant?: 'args' | 'result'
}) {
  const [open, toggle] = useToggle(`tool-call-display.collapsible-${label}`, defaultOpen)
  return (
    <div className="tool-call-display__collapsible">
      <button
        type="button"
        onClick={() => toggle()}
        className="tool-call-display__collapsible-btn"
      >
        {open ? <ChevronDown className="tool-call-display__collapsible-icon" /> : <ChevronRight className="tool-call-display__collapsible-icon" />}
        <span>{label}</span>
        {dotVariant && <span className={`tool-call-display__collapsible-dot tool-call-display__collapsible-dot--${dotVariant}`} />}
      </button>
      {open && <div className="tool-call-display__collapsible-body">{children}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Tool call card                                                     */
/* ------------------------------------------------------------------ */

function ToolCallCard({ call, index, total }: { call: ParsedToolCall; index: number; total: number }) {
  const meta = getToolMeta(call.name)
  const categoryRingClass = CATEGORY_RING_CLASS[meta.category]

  return (
    <div
      className={`tool-call-card ${categoryRingClass}`}
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'backwards' }}
    >
      <div className={`tool-call-card__accent-bar ${meta.gradientClass}`} />
      <div className="tool-call-card__header">
        <div className={`tool-call-card__icon ${meta.gradientClass} ${meta.glowClass}`}>
          {meta.icon}
        </div>
        <div className="tool-call-card__info">
          <div className="tool-call-card__title-row">
            <span className="tool-call-card__label">{meta.label}</span>
            {total > 1 && (
              <span className="tool-call-card__counter">
                {index + 1}/{total}
              </span>
            )}
          </div>
          <span className="tool-call-card__name">{call.name}</span>
        </div>
        <div className="tool-call-card__status">
          {call.isOk ? (
            <div className="tool-call-card__status-badge tool-call-card__status-badge--ok">
              <CheckCircle2 className="tool-call-card__status-icon tool-call-card__status-icon--ok" />
              <span className="tool-call-card__status-text tool-call-card__status-text--ok">OK</span>
            </div>
          ) : (
            <div className="tool-call-card__status-badge tool-call-card__status-badge--err">
              <XCircle className="tool-call-card__status-icon tool-call-card__status-icon--err" />
              <span className="tool-call-card__status-text tool-call-card__status-text--err">ERR</span>
            </div>
          )}
        </div>
      </div>
      <div className="tool-call-card__body">
        <CollapsibleSection label="Arguments" dotVariant="args">
          <JsonSyntax value={call.args} />
        </CollapsibleSection>
        <CollapsibleSection label="Result" defaultOpen dotVariant="result">
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
      <div className="tool-running-pill">
        <div className="tool-running-pill__dots">
          <span className="tool-running-pill__dot" />
          <span className="tool-running-pill__dot" />
          <span className="tool-running-pill__dot" />
        </div>
        <span className="tool-running-pill__text">Running tool…</span>
      </div>
    )
  }

  return (
    <div className="tool-running-pill__list">
      {toolNames.map((name) => {
        const meta = getToolMeta(name)
        return (
          <div key={name} className={`tool-running-pill__item ${CATEGORY_RING_CLASS[meta.category]}`}>
            <div className={`tool-running-pill__item-icon ${meta.gradientClass}`}>{meta.icon}</div>
            <span className="tool-running-pill__item-label">{meta.label}</span>
            <div className="tool-running-pill__item-dots">
              <span className="tool-running-pill__item-dot" />
              <span className="tool-running-pill__item-dot" />
              <span className="tool-running-pill__item-dot" />
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
    return <p className="tool-call-display__text">{content}</p>
  }

  return (
    <div className="tool-call-display">
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
        return <p key={`text-${index}`} className="tool-call-display__text">{part}</p>
      })}
    </div>
  )
}
