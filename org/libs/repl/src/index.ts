// Session
export { Session } from './session/session'
export type { SessionOptions } from './session/session'
export type { SessionConfig, PartialSessionConfig } from './session/config'
export { createDefaultConfig, validateConfig, mergeConfig } from './session/config'

// Conversation State
export { ConversationRecorder, computeScopeDelta, serializeTasklistsState } from './session/conversation-state'
export type {
  ConversationState,
  ConversationTurn,
  TurnBoundary,
  TurnEvent,
  ScopeDelta,
  SerializedTasklistsState,
  SerializedTasklistState,
  SerializedTaskCompletion,
} from './session/conversation-state'

export type {
  SessionStatus,
  SessionEvent,
  SessionSnapshot,
  StopPayload,
  ErrorPayload,
  AsyncCancellation,
  AskCancellation,
  ScopeEntry,
  SerializedJSX,
  SerializedValue,
  Hook,
  ASTPattern,
  HookMatch,
  HookContext,
  HookAction,
  StreamPauseController,
  StatementExecutor,
  RenderSurface,
  LineResult,
  TaskDefinition,
  Tasklist,
  TaskCompletion,
  TasklistsState,
  AgentStatus,
  AgentPromiseEntry,
  AgentSnapshot,
  AgentSpawnConfig,
  AgentSpawnResult,
  ClassMethodInfo,
} from './session/types'

// Sandbox
export { Sandbox } from './sandbox/sandbox'
export type { SandboxOptions, SandboxResourceLimits, SandboxResourceUsage } from './sandbox/sandbox'
export { transpile } from './sandbox/transpiler'
export { executeLine } from './sandbox/executor'
export { AsyncManager } from './sandbox/async-manager'
export { createGlobals } from './sandbox/globals'
export type { GlobalsConfig, ContextBudgetSnapshot, ReflectRequest, ReflectResult, SpeculateBranch, SpeculateBranchResult, SpeculateResult, CompressOptions, ForkRequest, ForkResult, TraceSnapshot, CheckpointData, CritiqueResult } from './sandbox/globals'
export { AgentRegistry } from './sandbox/agent-registry'
export type { AgentRegistryConfig } from './sandbox/agent-registry'
export { VectorIndex } from './sandbox/vector-index'
export type { VectorMatch, VectorIndexOptions } from './sandbox/vector-index'

// Stream
export { StreamController } from './stream/stream-controller'
export type { StreamControllerOptions } from './stream/stream-controller'
export { serialize } from './stream/serializer'
export type { SerializationLimits } from './stream/serializer'
export { createLineAccumulator, feed, flush, clear } from './stream/line-accumulator'
export { createBracketState, feedChunk, isBalanced, resetBracketState } from './stream/bracket-tracker'

// Parser
export { isCompleteStatement } from './parser/statement-detector'
export { detectGlobalCall } from './parser/global-detector'
export type { GlobalName } from './parser/global-detector'
export { parseStatement, extractDeclarations, recoverArgumentNames, extractVariableNames } from './parser/ast-utils'

// Context
export { generateScopeTable, describeType, truncateValue } from './context/scope-generator'
export { compressCodeWindow, buildSummaryComment } from './context/code-window'
export { getDecayLevel, decayStopPayload, decayErrorMessage } from './context/stop-decay'
export { buildSystemPrompt, updateScopeInPrompt } from './context/system-prompt'
export { isKnowledgeContent, tagAsKnowledge, decayKnowledgeValue, getKnowledgeDecayLevel, KNOWLEDGE_TAG } from './context/knowledge-decay'
export type { KnowledgeDecayTiers, KnowledgeDecayLevel } from './context/knowledge-decay'
export { buildStopMessage, buildErrorMessage, buildInterventionMessage, buildHookInterruptMessage, buildTasklistReminderMessage, buildTaskContinueMessage, buildTaskOrderViolationMessage, generateCurrentTaskBlock, generateTasksBlock, renderTaskLine } from './context/message-builder'
export { generateAgentsBlock } from './context/agents-block'

// Prompt Builder (composable system prompt assembly)
export { SystemPromptBuilder, buildSystemPromptFromConfig } from './context/prompt'
export type { SystemPromptConfig, SectionName } from './context/prompt/config'
export { FocusController } from './context/prompt/focus'

// Hooks
export { HookRegistry } from './hooks/hook-registry'
export { matchPattern, findMatches } from './hooks/pattern-matcher'
export { executeHooks } from './hooks/hook-executor'
export type { HookExecutionResult } from './hooks/hook-executor'

// Security
export { wrapFunction, FunctionRegistry } from './security/function-registry'
export type { RegistryOptions } from './security/function-registry'
export { sanitizeJSX, isJSXSafe, validateFormComponents } from './security/jsx-sanitizer'

// Catalog
export type { CatalogFunction, CatalogModule } from './catalog/types'
export { loadCatalog, mergeCatalogs, getCatalogModule, formatCatalogForPrompt } from './catalog/index'
export { loadMcpServers, loadMcpServersFromConfig } from './catalog/mcp'
export type { McpServerEntry, McpServerConfig } from './catalog/mcp'

// Knowledge
export type { KnowledgeTree, KnowledgeDomain, KnowledgeField, KnowledgeOption, KnowledgeSelector, KnowledgeContent, FlatKnowledgeSelector, FlatKnowledgeContent } from './knowledge/types'
export { buildKnowledgeTree, mergeKnowledgeTrees, loadKnowledgeFiles, formatKnowledgeTreeForPrompt } from './knowledge/index'
export { saveKnowledgeFile, deleteKnowledgeFile, parseFieldPath, ensureMemoryDomain } from './knowledge/writer'

// Git (auto-commit for file writes)
export { GitClient, createGitClient } from './git/client'
export type { GitClientOptions, GitCommitResult, GitStatusResult } from './git/client'

// THING Agent Entry Point
export { createThingSession, quickStart, ThingAgent } from './thing/entry'
export type { ThingEntryPointOptions } from './thing/entry'

// Web Search (Catalog module)
export { webSearch, formatWebSearchResults } from './catalog/web-search'
export type { WebSearchResult, WebSearchResponse } from './catalog/web-search'

// Spaces (space creation utilities and hot-reload)
export {
  generatePackageJson,
  generateAgentConfig,
  generateSpaceStructure,
  generateSpaceFileBlocks,
  validateSpaceName,
  slugifySpaceName,
  watchSpaces,
  isFileWatchingSupported,
  createDynamicSpaceLoader,
} from './spaces'
export type {
  SpaceMetadata,
  AgentDefinition,
  SpaceWatcherOptions,
  SpaceWatcherHandle,
  DynamicSpaceLoaderOptions,
  DynamicSpaceLoaderHandle,
} from './spaces'
