// Re-export core types from @lmthing/repl for convenience
export {
  Session,
  createDefaultConfig,
  validateConfig,
  mergeConfig,
  ConversationRecorder,
  computeScopeDelta,
  serializeTasklistsState,
  Sandbox,
  transpile,
  executeLine,
  AsyncManager,
  createGlobals,
  AgentRegistry,
  StreamController,
  serialize,
  createLineAccumulator,
  feed,
  flush,
  clear,
  createBracketState,
  feedChunk,
  isBalanced,
  resetBracketState,
  isCompleteStatement,
  detectGlobalCall,
  parseStatement,
  extractDeclarations,
  recoverArgumentNames,
  extractVariableNames,
  generateScopeTable,
  describeType,
  truncateValue,
  compressCodeWindow,
  buildSummaryComment,
  getDecayLevel,
  decayStopPayload,
  decayErrorMessage,
  buildSystemPrompt as buildSystemPromptTemplate,
  updateScopeInPrompt,
  isKnowledgeContent,
  tagAsKnowledge,
  decayKnowledgeValue,
  getKnowledgeDecayLevel,
  KNOWLEDGE_TAG,
  buildStopMessage,
  buildErrorMessage,
  buildInterventionMessage,
  buildHookInterruptMessage,
  buildTasklistReminderMessage,
  buildTaskContinueMessage,
  buildTaskOrderViolationMessage,
  generateCurrentTaskBlock,
  generateTasksBlock,
  renderTaskLine,
  generateAgentsBlock,
  HookRegistry,
  matchPattern,
  findMatches,
  executeHooks,
  wrapFunction,
  FunctionRegistry,
  sanitizeJSX,
  isJSXSafe,
  validateFormComponents,
  loadCatalog,
  mergeCatalogs,
  getCatalogModule,
  formatCatalogForPrompt,
  buildKnowledgeTree,
  mergeKnowledgeTrees,
  loadKnowledgeFiles,
  formatKnowledgeTreeForPrompt,
  saveKnowledgeFile,
  deleteKnowledgeFile,
  parseFieldPath,
  ensureMemoryDomain,
} from '@lmthing/repl'

export type {
  SessionOptions,
  SessionConfig,
  PartialSessionConfig,
  ConversationState,
  ConversationTurn,
  TurnBoundary,
  TurnEvent,
  ScopeDelta,
  SerializedTasklistsState,
  SerializedTasklistState,
  SerializedTaskCompletion,
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
  SandboxOptions,
  StreamControllerOptions,
  SerializationLimits,
  GlobalName,
  GlobalsConfig,
  AgentRegistryConfig,
  HookExecutionResult,
  RegistryOptions,
  CatalogFunction,
  CatalogModule,
  KnowledgeTree,
  KnowledgeDomain,
  KnowledgeField,
  KnowledgeOption,
  KnowledgeSelector,
  KnowledgeContent,
  FlatKnowledgeSelector,
  FlatKnowledgeContent,
  KnowledgeDecayTiers,
  KnowledgeDecayLevel,
} from '@lmthing/repl'

// Agent runner
export { runAgent } from './cli/run-agent'
export type { RunAgentOptions, RunAgentResult } from './cli/run-agent'

// Agent loop
export { AgentLoop } from './cli/agent-loop'
export type { AgentLoopOptions, ChatMessage } from './cli/agent-loop'

// Agent loader
export {
  loadAgent,
  parseInstructFrontmatter,
  resolveLocalFunctions,
  resolveAgentComponents,
  resolveKnowledgeConfig,
  parseFlow,
  formatActionsForPrompt,
  generateTasklistCode,
} from './cli/agent-loader'
export type { AgentAction, LoadedAgent, FlowStep, ParsedFlow, KnowledgeConfig, ResolvedComponents } from './cli/agent-loader'

// Loader (TypeScript compiler)
export { classifyExports, formatExportsForPrompt, formatCollapsedClass, formatExpandedClass } from './cli/loader'
export type { ParamInfo, PropInfo, ClassifiedExport, FormattedExports } from './cli/loader'

// System prompt builder
export { buildSystemPrompt } from './cli/buildSystemPrompt'

// Server
export { createReplServer } from './cli/server'
export type { ServerOptions } from './cli/server'

// RPC
export type { ReplSession } from './rpc/interface'
export { ReplSessionServer } from './rpc/server'
export { connectToRepl } from './rpc/client'

// Web
export { useReplSession } from './web/rpc-client'
export type { UseReplSessionResult, UIBlock } from './web/rpc-client'

// Providers
export { resolveModel, type ModelInput } from './providers/resolver'
export { ProviderError, ErrorCodes } from './providers/errors'
export type { ProviderName } from './providers/index'
export { getProvider, listProviders } from './providers/index'
export {
  scanCustomProviders,
  createCustomProvider,
  getCustomProviders,
  getCustomProvider,
  isCustomProvider,
  listCustomProviders,
  type CustomProviderConfig,
} from './providers/custom'

// Spawn
export { executeSpawn } from './spawn'
export type { SpawnConfig, SpawnResult, SpawnContext } from './spawn'

// Agent namespaces
export {
  buildSpaceAgentTrees,
  createNamespaceGlobals,
  formatAgentTreeForPrompt,
  createKnowledgeNamespace,
  formatKnowledgeNamespaceForPrompt,
  toNamespaceId,
  readSpaceDependencies,
  extractParamSchema,
} from './agent-namespaces'
export type { SpaceAgentTree, DependencyTree, AgentEntry, ParamSchema, DomainParam } from './agent-namespaces'
