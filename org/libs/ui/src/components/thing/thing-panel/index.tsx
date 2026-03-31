/**
 * ThingPanel - AI agent chat interface.
 * Adapted from the old ThingPanel to use the new FS state layer.
 * Provides a conversational interface with tool-calling for workspace operations.
 */
import { useCallback, useEffect, useMemo, useRef, type FormEvent } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { Bot, Plus, ArrowLeft } from 'lucide-react'
import { useApp, useUIState, useToggle } from '@lmthing/state'
import { CozyThingText } from '@lmthing/ui/elements/branding/cozy-text'

import '@lmthing/css/elements/forms/button/index.css'
import '@lmthing/css/elements/forms/input/index.css'
import '@lmthing/css/components/thing/thing-panel/index.css'

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

type ThingModelId = string

// ── Provider URL map (OpenAI-compatible) ────────────────────────────────

const PROVIDER_BASE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  groq: 'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  mistral: 'https://api.mistral.ai/v1',
}

const PROVIDER_ENV_KEYS: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  groq: 'GROQ_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  google: 'GOOGLE_GENERATIVE_AI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
}

// ── Constants ──────────────────────────────────────────────────────────

const CONVERSATIONS_KEY = 'lmthing-thing-conversations-v2'
const TOOL_EVENT_OPEN = '[[THING_TOOL_EVENT]]'
const TOOL_EVENT_CLOSE = '[[/THING_TOOL_EVENT]]'

const WELCOME_MESSAGE =
  'I am THING. I can help you manage your studios, spaces, agents, workflows, and knowledge. Ask me anything or type help.'

const HELP_MESSAGE = [
  'Available commands:',
  '  help    — Show this help message',
  '  status  — Show current studios and data summary',
  '',
  'You can also ask naturally, e.g.:',
  '  "Create a new studio called my-project"',
  '  "List all my studios"',
  '  "What agents are in this space?"',
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

function getWindowEnv(): Record<string, string | undefined> {
  return typeof window !== 'undefined'
    ? (window as Window & { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
    : {}
}

function resolveModelId(): ThingModelId {
  const env = getWindowEnv()
  const configured = env.LMTHING_THING_MODEL || env.LM_MODEL_DEFAULT || env.LM_MODEL_FAST || env.LM_MODEL_LARGE
  if (typeof configured === 'string' && configured.includes(':')) return configured
  return 'openai:gpt-4o-mini'
}

function resolveApiConfig(modelId: string): { baseUrl: string; apiKey: string; model: string } | null {
  const colonIdx = modelId.indexOf(':')
  if (colonIdx === -1) return null
  const provider = modelId.slice(0, colonIdx)
  const model = modelId.slice(colonIdx + 1)
  const env = getWindowEnv()

  // Check for explicit base URL / key overrides
  const baseUrl = env.LM_API_BASE_URL || env[`${provider.toUpperCase()}_BASE_URL`] || PROVIDER_BASE_URLS[provider]
  const envKey = PROVIDER_ENV_KEYS[provider] || `${provider.toUpperCase()}_API_KEY`
  const apiKey = env[envKey]

  if (!baseUrl || !apiKey) return null
  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey, model }
}

function checkHasEnv(): boolean {
  const env = getWindowEnv()
  const providerKeys = [
    'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY',
    'MISTRAL_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY',
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
    <div className="thing-msg__text">
      {parts.map((part, i) => {
        const closeIdx = part.indexOf(TOOL_EVENT_CLOSE)
        if (closeIdx === -1) return <span key={i}>{part}</span>
        const toolContent = part.slice(0, closeIdx)
        const rest = part.slice(closeIdx + TOOL_EVENT_CLOSE.length)
        return (
          <span key={i}>
            <div className="thing-tool-event">
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
  const navigate = useNavigate()
  const { username } = useParams({ strict: false }) as { username?: string }
  const { studios, appFS, createStudio, deleteStudio } = useApp()

  const [input, setInput] = useUIState<string>('thing-panel.input', '')
  const [conversations, setConversations] = useUIState<ThingConversation[]>('thing-panel.conversations', loadConversations())
  const [currentId, setCurrentId] = useUIState<string | null>('thing-panel.currentId', null)
  const [isWorking, , setIsWorking] = useToggle('thing-panel.isWorking', false)
  const [hasError, , setHasError] = useToggle('thing-panel.hasError', false)

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

  // ── Tool definitions ──────────────────────────────────────────────

  const toolExecutors = useMemo(() => ({
    listStudios: async () => {
      const list = studios.filter(s => s.username === username)
      return { ok: true, studios: list.map(s => ({ id: s.studioId, name: s.name })) }
    },
    createStudio: async ({ studioId, name }: { studioId: string; name: string }) => {
      if (!username) return { ok: false, message: 'No username available.' }
      createStudio(username, studioId, name)
      return { ok: true, message: `Created studio "${name}" (${studioId}).` }
    },
    deleteStudio: async ({ studioId }: { studioId: string }) => {
      if (!username) return { ok: false, message: 'No username available.' }
      deleteStudio(username, studioId)
      return { ok: true, message: `Deleted studio ${studioId}.` }
    },
    listFiles: async ({ prefix }: { prefix?: string }) => {
      const allFiles = Object.keys(appFS.getSnapshot())
      const filtered = prefix ? allFiles.filter(f => f.startsWith(prefix)) : allFiles
      return { ok: true, files: filtered.slice(0, 100), total: filtered.length }
    },
    readFile: async ({ path }: { path: string }) => {
      const content = appFS.readFile(path)
      if (content === null) return { ok: false, message: `File not found: ${path}` }
      return { ok: true, path, content: content.slice(0, 4000) }
    },
    writeFile: async ({ path, content }: { path: string; content: string }) => {
      appFS.writeFile(path, content)
      return { ok: true, message: `Wrote ${content.length} chars to ${path}.` }
    },
    deleteFile: async ({ path }: { path: string }) => {
      appFS.deleteFile(path)
      return { ok: true, message: `Deleted ${path}.` }
    },
  }), [studios, username, appFS, createStudio, deleteStudio])

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

    const apiConfig = resolveApiConfig(model)
    if (!apiConfig) {
      return 'Error: No API configuration found. Make sure environment variables with API keys are set.'
    }

    const userStudios = studios.filter(s => s.username === username)
    const systemPrompt = [
      'You are THING, the built-in AI agent for lmthing — a platform for building and managing AI agent studios.',
      '',
      'lmthing organizes work into: Users → Studios → Spaces.',
      'Each space contains: agents, workflows, knowledge fields, and configuration.',
      '',
      'You can create studios, manage files, and help users navigate their data.',
      'Be concise, precise, and helpful.',
      '',
      'CURRENT STATE:',
      stringifyJson({ username, studios: userStudios.map(s => ({ id: s.studioId, name: s.name })) }),
    ].join('\n')

    const tools = [
      { name: 'listStudios', description: 'List all studios for the current user.', parameters: { type: 'object', properties: {}, required: [] } },
      { name: 'createStudio', description: 'Create a new studio.', parameters: { type: 'object', properties: { studioId: { type: 'string' }, name: { type: 'string' } }, required: ['studioId', 'name'] } },
      { name: 'deleteStudio', description: 'Delete a studio by ID.', parameters: { type: 'object', properties: { studioId: { type: 'string' } }, required: ['studioId'] } },
      { name: 'listFiles', description: 'List all files in the virtual file system.', parameters: { type: 'object', properties: { prefix: { type: 'string' } }, required: [] } },
      { name: 'readFile', description: 'Read a file from the virtual file system.', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
      { name: 'writeFile', description: 'Write content to a file in the virtual file system.', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } },
      { name: 'deleteFile', description: 'Delete a file from the virtual file system.', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
    ]

    type OAIMessage = { role: string; content: string; tool_call_id?: string; name?: string }
    type OAIToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } }

    const messages: OAIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...conversation.map(m => ({ role: m.role, content: m.content })),
    ]

    try {
      let finalText = ''
      // Tool-call loop (max 5 steps)
      for (let step = 0; step < 5; step++) {
        const isLastStep = step === 4

        const res = await fetch(`${apiConfig.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiConfig.apiKey}`,
          },
          body: JSON.stringify({
            model: apiConfig.model,
            messages,
            tools: isLastStep ? undefined : tools.map(t => ({ type: 'function', function: t })),
            tool_choice: isLastStep ? undefined : 'auto',
            temperature: 0.1,
            max_tokens: 600,
            stream: true,
          }),
        })

        if (!res.ok || !res.body) {
          const errorText = await res.text().catch(() => res.statusText)
          throw new Error(`API error ${res.status}: ${errorText}`)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let assistantText = ''
        const toolCallMap: Map<number, { id: string; name: string; args: string }> = new Map()
        let finishReason: string | null = null

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') break
            try {
              const chunk = JSON.parse(data)
              const choice = chunk.choices?.[0]
              if (!choice) continue
              if (choice.finish_reason) finishReason = choice.finish_reason
              const delta = choice.delta
              if (delta?.content) {
                assistantText += delta.content
                onTextDelta?.(delta.content)
              }
              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  if (!toolCallMap.has(tc.index)) {
                    toolCallMap.set(tc.index, { id: tc.id || '', name: tc.function?.name || '', args: '' })
                  }
                  const entry = toolCallMap.get(tc.index)!
                  if (tc.id) entry.id = tc.id
                  if (tc.function?.name) entry.name += tc.function.name
                  if (tc.function?.arguments) entry.args += tc.function.arguments
                }
              }
            } catch { /* skip malformed */ }
          }
        }

        finalText = assistantText

        if (finishReason !== 'tool_calls' || toolCallMap.size === 0) break

        // Execute tool calls
        const toolCalls: OAIToolCall[] = Array.from(toolCallMap.values()).map(tc => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: tc.args },
        }))

        const toolNames = toolCalls.map(tc => tc.function.name)
        onToolEvent?.(toToolEventBlock(`🔧 Running tool${toolNames.length > 1 ? 's' : ''}: ${toolNames.join(', ')}`))

        messages.push({ role: 'assistant', content: assistantText || '', ...toolCalls.length ? { tool_calls: toolCalls } : {} } as unknown as OAIMessage)

        for (const tc of toolCalls) {
          const name = tc.function.name as keyof typeof toolExecutors
          let result: unknown
          try {
            const args = JSON.parse(tc.function.arguments || '{}')
            result = await (toolExecutors[name] as (a: unknown) => Promise<unknown>)?.(args) ?? { ok: false, message: `Unknown tool: ${name}` }
          } catch (e) {
            result = { ok: false, message: e instanceof Error ? e.message : 'Tool error' }
          }
          onToolEvent?.(toToolEventBlock(`🔧 ${name}\n⤷ result: ${stringifyJson(result)}`))
          messages.push({ role: 'tool', content: stringifyJson(result), tool_call_id: tc.id, name } as OAIMessage)
        }
      }

      return finalText.trim() || 'Done.'
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return `Error: ${message}\n\nMake sure environment variables with API keys are configured.`
    }
  }, [studios, username, appFS, model, toolExecutors])

  // ── Run conversation ──────────────────────────────────────────────

  const runConversation = useCallback((conversationId: string, conversation: ThingMessage[]) => {
    const responseId = `thing-response-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    updateMessages(conversationId, [
      ...conversation,
      { id: responseId, role: 'assistant', content: '' },
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
              m.id === responseId ? { ...m, content: (m.content || '') + text } : m
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
            m.id === responseId
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

  const statusDotClass = `thing-panel__status-dot ${
    hasError ? 'thing-panel__status-dot--error'
    : isWorking ? 'thing-panel__status-dot--working'
    : hasEnv ? 'thing-panel__status-dot--ready'
    : 'thing-panel__status-dot--warn'
  }`

  return (
    <div className={`thing-panel ${fullPage ? 'thing-panel--full' : 'thing-panel--embedded'}`}>
      {/* Sidebar */}
      <div className="thing-panel__sidebar">
        {/* Sidebar header */}
        <div className="thing-panel__sidebar-header">
          <div className="thing-panel__sidebar-title">
            {fullPage && (
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => navigate({ to: username ? `/${encodeURIComponent(username)}` : '/' })}
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div className="thing-panel__sidebar-brand">
              <Bot size={18} />
              <span className="thing-panel__sidebar-brand-name">
                <CozyThingText text="THING" />
              </span>
            </div>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={createNewChat} disabled={isWorking}>
            <Plus size={14} />
          </button>
        </div>

        {/* Conversation list */}
        <div className="thing-panel__sidebar-list">
          {conversations.map(conv => {
            const isCurrent = conv.id === currentConversation?.id
            return (
              <button
                key={conv.id}
                onClick={() => setCurrentId(conv.id)}
                className={`thing-panel__conv-btn ${isCurrent ? 'thing-panel__conv-btn--active' : ''}`}
              >
                {conv.title}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main chat area */}
      <div className="thing-panel__main">
        {/* Chat header */}
        <div className="thing-panel__chat-header">
          <span className="thing-panel__chat-title">
            {currentConversation?.title || 'Chat'}
          </span>
          <div className="thing-panel__chat-status">
            {isWorking && (
              <span className="thing-panel__chat-status-text">Processing...</span>
            )}
            <span className={statusDotClass} />
          </div>
        </div>

        {/* Messages */}
        <div className="thing-panel__messages">
          {!hasEnv && (
            <div className="thing-panel__env-warning">
              <strong>Environment not configured.</strong> THING needs API keys to call LLMs.
              Add environment variables (e.g., <code>OPENAI_API_KEY</code>) to enable AI features.
            </div>
          )}

          {messages.map(msg => (
            <div
              key={msg.id}
              className={`thing-msg ${msg.role === 'user' ? 'thing-msg--user' : 'thing-msg--assistant'}`}
            >
              <div className="thing-msg__role">
                {msg.role === 'user' ? 'You' : 'Thing'}
              </div>
              {msg.role === 'assistant' ? (
                <ToolCallDisplay content={msg.content} />
              ) : (
                <div className="thing-msg__text">
                  {msg.content}
                </div>
              )}
            </div>
          ))}

          {isWorking && !messages.some(m => m.role === 'assistant' && m.content === '') && (
            <div className="thing-msg__processing">
              Processing...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="thing-panel__input-form">
          <textarea
            className="input thing-panel__textarea"
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
