/**
 * ThingPanel - AI assistant chat interface.
 * Adapted from the old ThingPanel to use the new FS state layer.
 * Provides a conversational interface with tool-calling for workspace operations.
 */
import { useState, useCallback, useEffect, useMemo, useRef, type FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Bot, Plus, ArrowLeft } from 'lucide-react'
import { runPrompt, type PromptConfig } from 'lmthing'
import { z } from 'zod'
import { useApp } from '@lmthing/state'
import { CozyThingText } from '@/CozyText'

import '@/css/elements/forms/button/index.css'
import '@/css/elements/forms/input/index.css'

// ── Types ──────────────────────────────────────────────────────────────

type ThingMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

type ThingConversation = {
  id: string
  title: string
  messages: ThingMessage[]
  createdAt: string
  updatedAt: string
}

type ThingModelId = Extract<PromptConfig['model'], string>

// ── Constants ──────────────────────────────────────────────────────────

const CONVERSATIONS_KEY = 'lmthing-thing-conversations-v2'
const TOOL_EVENT_OPEN = '[[THING_TOOL_EVENT]]'
const TOOL_EVENT_CLOSE = '[[/THING_TOOL_EVENT]]'

const WELCOME_MESSAGE =
  'I am THING. I can help you manage your studios, spaces, assistants, workflows, and knowledge. Ask me anything or type help.'

const HELP_MESSAGE = [
  'Available commands:',
  '  help    — Show this help message',
  '  status  — Show current studios and data summary',
  '',
  'You can also ask naturally, e.g.:',
  '  "Create a new studio called my-project"',
  '  "List all my studios"',
  '  "What assistants are in this space?"',
].join('\n')

const ACTION_NAMES = [
  'listStudios',
  'createStudio',
  'deleteStudio',
  'listFiles',
  'readFile',
  'writeFile',
  'deleteFile',
] as const

// ── Helpers ────────────────────────────────────────────────────────────

function isValidModelId(value: unknown): value is ThingModelId {
  if (typeof value !== 'string') return false
  const [provider, model] = value.split(':')
  return Boolean(provider?.trim() && model?.trim())
}

function resolveModelId(): ThingModelId {
  const env =
    typeof window !== 'undefined'
      ? (window as Window & { process?: { env?: Record<string, string | undefined> } }).process?.env
      : undefined

  const configured =
    env?.LMTHING_THING_MODEL
    || env?.LM_MODEL_DEFAULT
    || env?.LM_MODEL_FAST
    || env?.LM_MODEL_LARGE

  if (isValidModelId(configured)) return configured
  return 'zai:glm-4.5-air'
}

function checkHasEnv(): boolean {
  const env =
    typeof window !== 'undefined'
      ? (window as Window & { process?: { env?: Record<string, string | undefined> } }).process?.env
      : undefined

  if (!env) return false

  const providerKeys = [
    'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY',
    'MISTRAL_API_KEY', 'GROQ_API_KEY', 'ZAI_API_KEY', 'OPENROUTER_API_KEY',
  ]

  return providerKeys.some(key => {
    const value = env[key]
    return typeof value === 'string' && value.trim().length > 0 && !value.includes('your-')
  })
}

function toToolEventBlock(payload: string): string {
  return `${TOOL_EVENT_OPEN}\n${payload}\n${TOOL_EVENT_CLOSE}`
}

function createWelcomeMessage(): ThingMessage {
  return { id: 'thing-welcome', role: 'assistant', content: WELCOME_MESSAGE }
}

function createConversation(title?: string): ThingConversation {
  const now = new Date().toISOString()
  return {
    id: `thing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: title || 'New chat',
    messages: [createWelcomeMessage()],
    createdAt: now,
    updatedAt: now,
  }
}

function loadConversations(): ThingConversation[] {
  if (typeof window === 'undefined') return [createConversation()]
  try {
    const raw = window.localStorage.getItem(CONVERSATIONS_KEY)
    if (!raw) return [createConversation()]
    const parsed = JSON.parse(raw) as ThingConversation[]
    if (!Array.isArray(parsed) || parsed.length === 0) return [createConversation()]
    return parsed.map(c => ({
      ...c,
      title: c.title || 'Untitled',
      messages: Array.isArray(c.messages) && c.messages.length > 0 ? c.messages : [createWelcomeMessage()],
    }))
  } catch {
    return [createConversation()]
  }
}

function stringifyJson(value: unknown): string {
  try { return JSON.stringify(value, null, 2) } catch { return String(value) }
}

// ── ToolCallDisplay ────────────────────────────────────────────────────

function ToolCallDisplay({ content }: { content: string }) {
  const parts = content.split(TOOL_EVENT_OPEN)
  return (
    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {parts.map((part, i) => {
        const closeIdx = part.indexOf(TOOL_EVENT_CLOSE)
        if (closeIdx === -1) return <span key={i}>{part}</span>
        const toolContent = part.slice(0, closeIdx)
        const rest = part.slice(closeIdx + TOOL_EVENT_CLOSE.length)
        return (
          <span key={i}>
            <div style={{
              margin: '0.5rem 0',
              padding: '0.5rem',
              borderRadius: '0.375rem',
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              backgroundColor: 'var(--color-muted, #f1f5f9)',
              border: '1px solid var(--color-border)',
              opacity: 0.8,
            }}>
              {toolContent}
            </div>
            {rest}
          </span>
        )
      })}
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────

export interface ThingPanelProps {
  /** When true, renders as a full page instead of panel */
  fullPage?: boolean
  onStatusChange?: (status: { isStreaming: boolean; hasError: boolean }) => void
}

export function ThingPanel({ fullPage, onStatusChange }: ThingPanelProps) {
  const router = useRouter()
  const { username } = useParams<{ username: string }>()
  const { studios, appFS, createStudio, deleteStudio } = useApp()

  const [input, setInput] = useState('')
  const [conversations, setConversations] = useState<ThingConversation[]>(() => loadConversations())
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [isWorking, setIsWorking] = useState(false)
  const [hasError, setHasError] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const hasEnv = useMemo(() => checkHasEnv(), [])
  const model = useMemo(() => resolveModelId(), [])

  const currentConversation = useMemo(() => {
    if (conversations.length === 0) return null
    if (!currentId) return conversations[0]
    return conversations.find(c => c.id === currentId) || conversations[0]
  }, [conversations, currentId])

  const messages = useMemo(
    () => currentConversation?.messages || [createWelcomeMessage()],
    [currentConversation],
  )

  // Status callback
  useEffect(() => {
    onStatusChange?.({ isStreaming: isWorking, hasError: hasError })
  }, [isWorking, hasError, onStatusChange])

  // Persist conversations
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations))
  }, [conversations])

  // Ensure current conversation exists
  useEffect(() => {
    if (conversations.length === 0) {
      const fallback = createConversation()
      setConversations([fallback])
      setCurrentId(fallback.id)
      return
    }
    if (!currentId || !conversations.some(c => c.id === currentId)) {
      setCurrentId(conversations[0].id)
    }
  }, [conversations, currentId])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const updateMessages = useCallback((conversationId: string, msgs: ThingMessage[]) => {
    setConversations(prev => prev.map(c =>
      c.id === conversationId ? { ...c, messages: msgs, updatedAt: new Date().toISOString() } : c
    ))
  }, [])

  const createNewChat = useCallback(() => {
    const next = createConversation(`Chat ${conversations.length + 1}`)
    setConversations(prev => [next, ...prev])
    setCurrentId(next.id)
    setInput('')
  }, [conversations.length])

  // ── Core message handler ──────────────────────────────────────────

  const handleMessage = useCallback(async (
    conversation: ThingMessage[],
    onTextDelta?: (delta: string) => void,
    onToolEvent?: (message: string) => void,
  ): Promise<string> => {
    const lastUser = [...conversation].reverse().find(m => m.role === 'user')
    const normalized = lastUser?.content.trim() || ''

    if (!normalized) return 'Please enter a message.'
    if (normalized.toLowerCase() === 'help' || normalized === '/help') return HELP_MESSAGE
    if (normalized.toLowerCase() === 'status' || normalized === '/status') {
      const userStudios = studios.filter(s => s.username === username)
      return [
        `User: ${username || 'none'}`,
        `Studios: ${userStudios.length}`,
        ...userStudios.map(s => `  - ${s.name} (${s.studioId})`),
        `Total files in FS: ${Object.keys(appFS.getSnapshot()).length}`,
      ].join('\n')
    }

    try {
      const userStudios = studios.filter(s => s.username === username)
      const summary = {
        username,
        studios: userStudios.map(s => ({ id: s.studioId, name: s.name })),
        actionNames: ACTION_NAMES,
      }

      const { result } = await runPrompt(async (prompt) => {
        prompt.defSystem('role', [
          'You are THING, the built-in AI assistant for lmthing — a platform for building and managing AI agent studios.',
          '',
          'lmthing organizes work into: Users → Studios → Spaces.',
          'Each space contains: assistants, workflows, knowledge fields, and configuration.',
          '',
          'You can create studios, manage files, and help users navigate their data.',
          'Be concise, precise, and helpful.',
        ].join('\n'))

        prompt.defSystem('context', [
          'CURRENT STATE:',
          stringifyJson(summary),
        ].join('\n'))

        // ── Tools ──

        prompt.defTool(
          'listStudios',
          'List all studios for the current user.',
          z.object({}),
          async () => {
            const list = studios.filter(s => s.username === username)
            return { ok: true, studios: list.map(s => ({ id: s.studioId, name: s.name })) }
          },
        )

        prompt.defTool(
          'createStudio',
          'Create a new studio.',
          z.object({ studioId: z.string().min(1), name: z.string().min(1) }),
          async ({ studioId, name }: { studioId: string; name: string }) => {
            if (!username) return { ok: false, message: 'No username available.' }
            createStudio(username, studioId, name)
            return { ok: true, message: `Created studio "${name}" (${studioId}).` }
          },
        )

        prompt.defTool(
          'deleteStudio',
          'Delete a studio by ID.',
          z.object({ studioId: z.string().min(1) }),
          async ({ studioId }: { studioId: string }) => {
            if (!username) return { ok: false, message: 'No username available.' }
            deleteStudio(username, studioId)
            return { ok: true, message: `Deleted studio ${studioId}.` }
          },
        )

        prompt.defTool(
          'listFiles',
          'List all files in the virtual file system, optionally filtered by prefix.',
          z.object({ prefix: z.string().optional() }),
          async ({ prefix }: { prefix?: string }) => {
            const allFiles = Object.keys(appFS.getSnapshot())
            const filtered = prefix ? allFiles.filter(f => f.startsWith(prefix)) : allFiles
            return { ok: true, files: filtered.slice(0, 100), total: filtered.length }
          },
        )

        prompt.defTool(
          'readFile',
          'Read a file from the virtual file system.',
          z.object({ path: z.string().min(1) }),
          async ({ path }: { path: string }) => {
            const content = appFS.readFile(path)
            if (content === null) return { ok: false, message: `File not found: ${path}` }
            return { ok: true, path, content: content.slice(0, 4000) }
          },
        )

        prompt.defTool(
          'writeFile',
          'Write content to a file in the virtual file system.',
          z.object({ path: z.string().min(1), content: z.string() }),
          async ({ path, content }: { path: string; content: string }) => {
            appFS.writeFile(path, content)
            return { ok: true, message: `Wrote ${content.length} chars to ${path}.` }
          },
        )

        prompt.defTool(
          'deleteFile',
          'Delete a file from the virtual file system.',
          z.object({ path: z.string().min(1) }),
          async ({ path }: { path: string }) => {
            appFS.deleteFile(path)
            return { ok: true, message: `Deleted ${path}.` }
          },
        )

        conversation.forEach(msg => {
          prompt.defMessage(msg.role, msg.content)
        })
      }, {
        model,
        options: {
          temperature: 0.1,
          maxOutputTokens: 600,
          onStepFinish: (stepResult) => {
            const r = stepResult as {
              finishReason?: string
              toolCalls?: Array<{ toolName?: string; input?: unknown }>
              toolResults?: Array<{ toolName?: string; input?: unknown; output?: unknown }>
            }

            if (r.finishReason !== 'tool-calls') return

            const toolResults = r.toolResults || []
            if (toolResults.length > 0) {
              const lines = toolResults.map(tr => {
                const name = tr.toolName || 'unknown'
                return toToolEventBlock(`🔧 ${name}\n⤷ args: ${stringifyJson(tr.input)}\n⤷ result: ${stringifyJson(tr.output)}`)
              })
              onToolEvent?.(lines.join('\n\n'))
              return
            }

            const toolNames = (r.toolCalls || []).map(tc => tc.toolName).filter(Boolean)
            onToolEvent?.(toToolEventBlock(`🔧 Running tool${toolNames.length > 1 ? 's' : ''}: ${toolNames.join(', ') || '...'}`))
          },
        },
      })

      const streamCandidate = (result as { textStream?: unknown }).textStream
      let streamedText = ''

      if (streamCandidate && typeof streamCandidate === 'object' && Symbol.asyncIterator in streamCandidate) {
        for await (const delta of streamCandidate as AsyncIterable<string>) {
          streamedText += delta
          onTextDelta?.(delta)
        }
      }

      const text = await result.text
      return text?.trim() || streamedText.trim() || 'Done.'
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return `Error: ${message}\n\nMake sure environment variables with API keys are configured.`
    }
  }, [studios, username, appFS, model, createStudio, deleteStudio])

  // ── Run conversation ──────────────────────────────────────────────

  const runConversation = useCallback((conversationId: string, conversation: ThingMessage[]) => {
    const assistantId = `thing-assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    updateMessages(conversationId, [
      ...conversation,
      { id: assistantId, role: 'assistant', content: '' },
    ])

    setIsWorking(true)
    setHasError(false)

    void (async () => {
      const appendText = (text: string) => {
        if (!text) return
        setConversations(prev => prev.map(c => {
          if (c.id !== conversationId) return c
          return {
            ...c,
            updatedAt: new Date().toISOString(),
            messages: c.messages.map(m =>
              m.id === assistantId ? { ...m, content: (m.content || '') + text } : m
            ),
          }
        }))
      }

      let response: string
      try {
        response = await handleMessage(
          conversation,
          delta => appendText(delta),
          event => appendText(`\n\n${event}\n`),
        )
      } catch (error) {
        setHasError(true)
        response = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }

      setConversations(prev => prev.map(c => {
        if (c.id !== conversationId) return c
        return {
          ...c,
          updatedAt: new Date().toISOString(),
          messages: c.messages.map(m =>
            m.id === assistantId
              ? { ...m, content: m.content?.trim() ? m.content : response }
              : m
          ),
        }
      }))

      setIsWorking(false)
    })()
  }, [handleMessage, updateMessages])

  // ── Submit ────────────────────────────────────────────────────────

  const handleSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isWorking) return

    const userMessage: ThingMessage = {
      id: `thing-user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    }

    const nextMessages = [...messages, userMessage]
    setInput('')

    if (!currentConversation) return

    if (currentConversation.title === 'New chat' || currentConversation.title.startsWith('Chat ')) {
      setConversations(prev => prev.map(c =>
        c.id === currentConversation.id
          ? { ...c, title: trimmed.slice(0, 48), updatedAt: new Date().toISOString() }
          : c
      ))
    }

    runConversation(currentConversation.id, nextMessages)
  }, [input, messages, isWorking, runConversation, currentConversation])

  // ── Render ────────────────────────────────────────────────────────

  const containerStyle: React.CSSProperties = fullPage
    ? { display: 'flex', height: '100vh', background: 'var(--color-bg)' }
    : { display: 'flex', height: '100%', background: 'var(--color-bg)' }

  return (
    <div style={containerStyle}>
      {/* Sidebar */}
      <div style={{
        width: '16rem',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        {/* Sidebar header */}
        <div style={{
          padding: '1rem',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {fullPage && (
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => router.push(username ? `/${encodeURIComponent(username)}` : '/')}
                style={{ padding: '0.25rem' }}
              >
                <ArrowLeft style={{ width: 16, height: 16 }} />
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <Bot style={{ width: 18, height: 18 }} />
              <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                <CozyThingText text="THING" className="text-sm font-semibold" />
              </span>
            </div>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={createNewChat} disabled={isWorking}>
            <Plus style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {/* Conversation list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
          {conversations.map(conv => {
            const isCurrent = conv.id === currentConversation?.id
            return (
              <button
                key={conv.id}
                onClick={() => setCurrentId(conv.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: 'none',
                  background: isCurrent ? 'var(--color-muted, #f1f5f9)' : 'none',
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  fontWeight: isCurrent ? 600 : 400,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginBottom: '0.125rem',
                }}
              >
                {conv.title}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Chat header */}
        <div style={{
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
            {currentConversation?.title || 'Chat'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isWorking && (
              <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>Processing...</span>
            )}
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              display: 'inline-block',
              backgroundColor: hasError ? '#ef4444' : isWorking ? '#8b5cf6' : hasEnv ? '#10b981' : '#f59e0b',
            }} />
          </div>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}>
          {!hasEnv && (
            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-muted, #fef3c7)',
              fontSize: '0.8125rem',
            }}>
              <strong>Environment not configured.</strong> THING needs API keys to call LLMs.
              Add environment variables (e.g., <code>OPENAI_API_KEY</code>) to enable AI features.
            </div>
          )}

          {messages.map(msg => (
            <div
              key={msg.id}
              style={{
                maxWidth: '80%',
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                padding: '0.625rem 0.875rem',
                borderRadius: '0.75rem',
                fontSize: '0.875rem',
                lineHeight: '1.5',
                border: '1px solid var(--color-border)',
                backgroundColor: msg.role === 'user'
                  ? 'var(--color-primary, #8b5cf6)'
                  : 'var(--color-bg-elevated, white)',
                color: msg.role === 'user' ? 'white' : undefined,
              }}
            >
              <div style={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                opacity: 0.6,
                marginBottom: '0.25rem',
              }}>
                {msg.role === 'user' ? 'You' : 'Thing'}
              </div>
              {msg.role === 'assistant' ? (
                <ToolCallDisplay content={msg.content} />
              ) : (
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {msg.content}
                </div>
              )}
            </div>
          ))}

          {isWorking && !messages.some(m => m.role === 'assistant' && m.content === '') && (
            <div style={{
              alignSelf: 'flex-start',
              padding: '0.625rem 0.875rem',
              borderRadius: '0.75rem',
              border: '1px solid var(--color-border)',
              fontSize: '0.8125rem',
              opacity: 0.7,
            }}>
              Processing...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          style={{
            padding: '0.75rem 1rem',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'flex-end',
          }}
        >
          <textarea
            className="input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                e.currentTarget.form?.requestSubmit()
              }
            }}
            rows={2}
            placeholder={hasEnv ? 'Ask THING anything... (Enter to send, Shift+Enter for newline)' : 'Configure API keys to enable THING...'}
            disabled={!hasEnv}
            style={{
              flex: 1,
              resize: 'none',
              fontSize: '0.875rem',
            }}
          />
          <button
            type="submit"
            className="btn btn--primary"
            disabled={!hasEnv || isWorking || !input.trim()}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}

export { ThingPanel as default }
