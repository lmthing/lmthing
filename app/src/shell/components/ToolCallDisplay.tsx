import { useState, useMemo, type ReactNode } from 'react'
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
/*  Tool metadata — icon, gradient, label                             */
/* ------------------------------------------------------------------ */

type ToolMeta = {
  icon: ReactNode
  gradient: string
  glow: string
  label: string
  category: 'inspect' | 'workspace' | 'agent' | 'flow' | 'knowledge' | 'env' | 'misc'
}

const CATEGORY_RING: Record<ToolMeta['category'], string> = {
  inspect: 'ring-sky-400/30',
  workspace: 'ring-amber-400/30',
  agent: 'ring-violet-400/30',
  flow: 'ring-emerald-400/30',
  knowledge: 'ring-rose-400/30',
  env: 'ring-yellow-400/30',
  misc: 'ring-slate-400/30',
}

const iconSize = 'h-3.5 w-3.5'

const TOOL_META: Record<string, ToolMeta> = {
  viewWorkspaceData: {
    icon: <Eye className={iconSize} />,
    gradient: 'from-sky-500 to-cyan-400',
    glow: 'shadow-sky-500/20',
    label: 'View Data',
    category: 'inspect',
  },
  setCurrentWorkspace: {
    icon: <ArrowRightLeft className={iconSize} />,
    gradient: 'from-amber-500 to-orange-400',
    glow: 'shadow-amber-500/20',
    label: 'Switch Workspace',
    category: 'workspace',
  },
  reload: {
    icon: <RefreshCw className={iconSize} />,
    gradient: 'from-amber-500 to-yellow-400',
    glow: 'shadow-amber-500/20',
    label: 'Reload',
    category: 'workspace',
  },
  updatePackageJson: {
    icon: <Package className={iconSize} />,
    gradient: 'from-amber-500 to-orange-400',
    glow: 'shadow-amber-500/20',
    label: 'Update Package',
    category: 'workspace',
  },
  upsertAgent: {
    icon: <Bot className={iconSize} />,
    gradient: 'from-violet-500 to-purple-400',
    glow: 'shadow-violet-500/20',
    label: 'Upsert Agent',
    category: 'agent',
  },
  deleteAgent: {
    icon: <Trash2 className={iconSize} />,
    gradient: 'from-violet-500 to-rose-400',
    glow: 'shadow-violet-500/20',
    label: 'Delete Agent',
    category: 'agent',
  },
  upsertFlow: {
    icon: <Workflow className={iconSize} />,
    gradient: 'from-emerald-500 to-teal-400',
    glow: 'shadow-emerald-500/20',
    label: 'Upsert Flow',
    category: 'flow',
  },
  deleteFlow: {
    icon: <Trash2 className={iconSize} />,
    gradient: 'from-emerald-500 to-rose-400',
    glow: 'shadow-emerald-500/20',
    label: 'Delete Flow',
    category: 'flow',
  },
  upsertEnvFile: {
    icon: <Lock className={iconSize} />,
    gradient: 'from-yellow-500 to-amber-400',
    glow: 'shadow-yellow-500/20',
    label: 'Upsert Env',
    category: 'env',
  },
  deleteEnvFile: {
    icon: <Trash2 className={iconSize} />,
    gradient: 'from-yellow-500 to-rose-400',
    glow: 'shadow-yellow-500/20',
    label: 'Delete Env',
    category: 'env',
  },
  updateKnowledgeFileContent: {
    icon: <FileText className={iconSize} />,
    gradient: 'from-rose-500 to-pink-400',
    glow: 'shadow-rose-500/20',
    label: 'Update File Content',
    category: 'knowledge',
  },
  updateKnowledgeFileFrontmatter: {
    icon: <Pencil className={iconSize} />,
    gradient: 'from-rose-500 to-fuchsia-400',
    glow: 'shadow-rose-500/20',
    label: 'Update Frontmatter',
    category: 'knowledge',
  },
  updateKnowledgeDirectoryConfig: {
    icon: <FolderTree className={iconSize} />,
    gradient: 'from-rose-500 to-orange-400',
    glow: 'shadow-rose-500/20',
    label: 'Update Dir Config',
    category: 'knowledge',
  },
  addKnowledgeNode: {
    icon: <Plus className={iconSize} />,
    gradient: 'from-rose-500 to-pink-400',
    glow: 'shadow-rose-500/20',
    label: 'Add Node',
    category: 'knowledge',
  },
  updateKnowledgeNodePath: {
    icon: <ArrowRightLeft className={iconSize} />,
    gradient: 'from-rose-500 to-amber-400',
    glow: 'shadow-rose-500/20',
    label: 'Move Node',
    category: 'knowledge',
  },
  deleteKnowledgeNode: {
    icon: <Trash2 className={iconSize} />,
    gradient: 'from-rose-500 to-red-500',
    glow: 'shadow-rose-500/20',
    label: 'Delete Node',
    category: 'knowledge',
  },
  duplicateKnowledgeNode: {
    icon: <Copy className={iconSize} />,
    gradient: 'from-rose-500 to-pink-400',
    glow: 'shadow-rose-500/20',
    label: 'Duplicate Node',
    category: 'knowledge',
  },
}

const DEFAULT_TOOL_META: ToolMeta = {
  icon: <Wrench className={iconSize} />,
  gradient: 'from-slate-500 to-slate-400',
  glow: 'shadow-slate-500/20',
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

  try {
    return JSON.parse(trimmed)
  } catch {
    return trimmed
  }
}

function parseToolBlock(blockText: string): ParsedToolCall | null {
  const match = blockText.match(/🔧\s*(\S+)\n⤷\s*args:\s*([\s\S]*?)\n⤷\s*result:\s*([\s\S]*)$/)
  if (!match) return null

  const resultValue = parseJsonValue(match[3])
  const isOk = typeof resultValue === 'object'
    && resultValue !== null
    && 'ok' in (resultValue as Record<string, unknown>)
    && Boolean((resultValue as Record<string, unknown>).ok)

  return {
    name: match[1],
    args: parseJsonValue(match[2]),
    result: resultValue,
    isOk,
  }
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

    if (parsedCall) {
      toolCalls.push(parsedCall)
      textParts.push(`__TOOL_CALL_${toolCalls.length - 1}__`)
    } else if (blockContent) {
      textParts.push(blockContent)
    }

    taggedLastIndex = taggedMatch.index + taggedMatch[0].length
    taggedMatch = TOOL_EVENT_BLOCK_RE.exec(text)
  }

  if (hasTaggedBlocks) {
    const after = text.slice(taggedLastIndex).trim()
    if (after) textParts.push(after)
    return { toolCalls, textParts }
  }

  let lastIndex = 0

  // Reset regex state
  TOOL_BLOCK_RE.lastIndex = 0

  let match: RegExpExecArray | null = TOOL_BLOCK_RE.exec(text)
  while (match !== null) {
    const before = text.slice(lastIndex, match.index).trim()
    if (before) textParts.push(before)

    const resultStr = match[3].trim()
    const resultValue = parseJsonValue(resultStr)
    const isOk = typeof resultValue === 'object'
      && resultValue !== null
      && 'ok' in (resultValue as Record<string, unknown>)
      && Boolean((resultValue as Record<string, unknown>).ok)

    toolCalls.push({
      name: match[1],
      args: parseJsonValue(match[2].trim()),
      result: resultValue,
      isOk,
    })

    textParts.push(`__TOOL_CALL_${toolCalls.length - 1}__`)
    lastIndex = match.index + match[0].length

    match = TOOL_BLOCK_RE.exec(text)
  }

  const after = text.slice(lastIndex).trim()
  if (after) textParts.push(after)

  return { toolCalls, textParts }
}

/* ------------------------------------------------------------------ */
/*  JSON pretty-printer with syntax coloring                          */
/* ------------------------------------------------------------------ */

function JsonSyntax({ value }: { value: unknown }) {
  if (typeof value === 'string') {
    return (
      <pre className="max-h-52 overflow-auto rounded-md bg-slate-950/80 p-2.5 text-[11px] leading-relaxed text-slate-300 scrollbar-thin font-mono whitespace-pre-wrap break-words">
        {value}
      </pre>
    )
  }

  const jsonData = (value !== null && typeof value === 'object')
    ? value as Record<string, unknown> | unknown[]
    : { value }

  return (
    <div className="max-h-52 overflow-auto rounded-md border border-slate-200/70 bg-white p-2.5 text-[11px] dark:border-slate-700/60 dark:bg-slate-950/60">
      <JsonView data={jsonData} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Collapsible section                                               */
/* ------------------------------------------------------------------ */

function CollapsibleSection({
  label,
  children,
  defaultOpen = false,
  accentColor,
}: {
  label: string
  children: ReactNode
  defaultOpen?: boolean
  accentColor?: string
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
          'text-slate-500 hover:text-slate-700 hover:bg-slate-100',
          'dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60',
        )}
      >
        {open
          ? <ChevronDown className="h-3 w-3 shrink-0" />
          : <ChevronRight className="h-3 w-3 shrink-0" />}
        <span>{label}</span>
        {accentColor && (
          <span className={cn('ml-auto h-1.5 w-1.5 rounded-full', accentColor)} />
        )}
      </button>
      {open && <div className="mt-1 animate-fade-in">{children}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Single tool call card                                             */
/* ------------------------------------------------------------------ */

function ToolCallCard({
  call,
  index,
  total,
}: {
  call: ParsedToolCall
  index: number
  total: number
}) {
  const meta = getToolMeta(call.name)
  const categoryRing = CATEGORY_RING[meta.category]

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-lg border transition-all duration-300',
        'border-slate-200/80 dark:border-slate-700/60',
        'hover:border-slate-300 dark:hover:border-slate-600',
        'bg-white dark:bg-slate-900/70',
        'ring-1',
        categoryRing,
        'animate-fade-in',
      )}
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'backwards' }}
    >
      {/* Gradient accent bar */}
      <div
        className={cn(
          'absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r opacity-80 group-hover:opacity-100 transition-opacity',
          meta.gradient,
        )}
      />

      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 pt-3 pb-1.5">
        <div
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-white shadow-md',
            meta.gradient,
            meta.glow,
          )}
        >
          {meta.icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[12px] font-semibold text-slate-800 dark:text-slate-100">
              {meta.label}
            </span>
            {total > 1 && (
              <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-px text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {index + 1}/{total}
              </span>
            )}
          </div>
          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
            {call.name}
          </span>
        </div>

        {/* Status indicator */}
        <div className="shrink-0">
          {call.isOk ? (
            <div className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 dark:bg-emerald-950/40">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">OK</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 dark:bg-rose-950/40">
              <XCircle className="h-3 w-3 text-rose-500" />
              <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">ERR</span>
            </div>
          )}
        </div>
      </div>

      {/* Sections */}
      <div className="px-3 pb-2.5">
        <CollapsibleSection label="Arguments" accentColor="bg-violet-400">
          <JsonSyntax value={call.args} />
        </CollapsibleSection>

        <CollapsibleSection label="Result" defaultOpen accentColor="bg-emerald-400">
          <JsonSyntax value={call.result} />
        </CollapsibleSection>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  "Running" pill (for in-progress tool calls)                       */
/* ------------------------------------------------------------------ */

export function ToolRunningPill({ text }: { text: string }) {
  // Extract tool names from "🔧 Running tool(s): name1, name2"
  const toolNames = useMemo(() => {
    const match = text.match(/🔧\s*Running tools?:?\s*(.+)/i)
    if (!match) return []
    return match[1].split(',').map((name) => name.trim()).filter(Boolean)
  }, [text])

  if (toolNames.length === 0) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 px-3 py-1.5 dark:border-slate-700 dark:from-slate-800 dark:to-slate-900">
        <div className="flex gap-0.5">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400" style={{ animationDelay: '0ms' }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-500" style={{ animationDelay: '150ms' }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-600" style={{ animationDelay: '300ms' }} />
        </div>
        <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">Running tool…</span>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {toolNames.map((name) => {
        const meta = getToolMeta(name)
        return (
          <div
            key={name}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
              'border-slate-200/80 bg-white dark:border-slate-700/60 dark:bg-slate-900/70',
              'ring-1',
              CATEGORY_RING[meta.category],
            )}
          >
            <div className={cn('flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br text-white', meta.gradient)}>
              {meta.icon}
            </div>
            <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200">{meta.label}</span>
            <div className="flex gap-0.5">
              <span className="h-1 w-1 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '0ms' }} />
              <span className="h-1 w-1 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '150ms' }} />
              <span className="h-1 w-1 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Public: renders a message that may contain tool call blocks       */
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
          return (
            <ToolCallCard
              key={`tool-${callIndex}`}
              call={call}
              index={callIndex}
              total={toolCalls.length}
            />
          )
        }

        // Check if it's a "running" indicator
        if (/^🔧\s*Running tool/i.test(part)) {
          return <ToolRunningPill key={`running-${index}`} text={part} />
        }

        return (
          <p key={`text-${index}`} className="whitespace-pre-wrap break-words">
            {part}
          </p>
        )
      })}
    </div>
  )
}
