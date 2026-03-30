/**
 * Agent loop — drives the LLM streaming cycle in response to user messages.
 *
 * Manages the turn loop: stream LLM output → feed to session → handle
 * stop/error/tasklist events → inject messages → loop until complete.
 */

import { streamText, type LanguageModel } from "ai";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  Session,
  serialize,
  isKnowledgeContent,
  decayKnowledgeValue,
  buildTaskOrderViolationMessage,
  buildTaskContinueMessage,
  generateTasksBlock,
  generateCurrentTaskBlock,
  generateAgentsBlock,
} from "@lmthing/repl";
import type {
  SessionOptions,
  KnowledgeContent,
  SessionEvent,
  StopPayload,
  ErrorPayload,
  ContextBudgetSnapshot,
  ReflectRequest,
  ReflectResult,
} from "@lmthing/repl";
import type { ClassifiedExport } from "./loader";
import { formatCollapsedClass, formatExpandedClass } from "./loader";
import { buildSystemPrompt } from "./buildSystemPrompt";
import { generateTasklistCode, type ParsedFlow } from "./agent-loader";
import { executeSpawn } from "../spawn";
import type { SpawnConfig, SpawnResult, SpawnContext } from "../spawn";

export interface AgentLoopOptions {
  session: Session;
  model: LanguageModel;
  modelId: string;
  instruct?: string;
  functionSignatures?: string;
  formSignatures?: string;
  viewSignatures?: string;
  classSignatures?: string;
  classExports?: ClassifiedExport[];
  knowledgeTree?: string;
  maxTurns?: number;
  maxTasklistReminders?: number;
  debugFile?: string;
  actions?: Array<{ id: string; flow: ParsedFlow }>;
  catalogGlobals?: Record<string, unknown>;
  knowledgeLoader?: SessionOptions["knowledgeLoader"];
  getClassInfo?: SessionOptions["getClassInfo"];
  loadClass?: SessionOptions["loadClass"];
  agentTree?: string;
  /** Formatted knowledge namespace prompt (always available). */
  knowledgeNamespacePrompt?: string;
  /** Callback to rebuild the knowledge tree after a write. Returns updated prompt string. */
  rebuildKnowledgeTree?: () => string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface DebugEntry {
  timestamp: number;
  type:
    | "system_prompt"
    | "message"
    | "event"
    | "scope"
    | "api_error"
    | "turn"
    | "turn_result"
    | "finalize";
  data: unknown;
}

export class AgentLoop {
  private session: Session;
  private model: LanguageModel;
  private modelId: string;
  private instruct?: string;
  private functionSignatures: string;
  private formSignatures: string;
  private viewSignatures: string;
  private classSignatures: string;
  private classExports: ClassifiedExport[];
  private loadedClasses = new Set<string>();
  private knowledgeTree: string;
  private maxTurns: number;
  private maxTasklistReminders: number;
  private debugFile?: string;
  private actions: Map<string, ParsedFlow>;
  private messages: ChatMessage[] = [];
  private running = false;
  private debugLog: DebugEntry[] = [];
  private tokenTotals = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  private totalTurns = 0;
  private catalogGlobals: Record<string, unknown>;
  private knowledgeLoader?: SessionOptions["knowledgeLoader"];
  private getClassInfo?: SessionOptions["getClassInfo"];
  private loadClass?: SessionOptions["loadClass"];
  private agentTree: string;
  private knowledgeNamespacePrompt: string;
  private rebuildKnowledgeTree?: () => string;
  /** Tracks stop messages that contain knowledge content, for progressive decay. */
  private knowledgeStops: Array<{
    messageIndex: number;
    turn: number;
    payload: StopPayload;
    knowledgeKeys: Set<string>;
    knowledgeContent: Map<string, KnowledgeContent>;
  }> = [];
  /** Tracks retention hints per stop message for adaptive decay. */
  private stopRetentionHints: Map<number, 'high' | 'low'> = new Map();

  constructor(options: AgentLoopOptions) {
    this.session = options.session;
    this.model = options.model;
    this.modelId = options.modelId;
    this.instruct = options.instruct;
    this.functionSignatures = options.functionSignatures ?? "";
    this.formSignatures = options.formSignatures ?? "";
    this.viewSignatures = options.viewSignatures ?? "";
    this.classSignatures = options.classSignatures ?? "";
    this.classExports = options.classExports ?? [];
    this.knowledgeTree = options.knowledgeTree ?? "";
    this.maxTurns = options.maxTurns ?? 10;
    this.maxTasklistReminders = options.maxTasklistReminders ?? 3;
    this.debugFile = options.debugFile;
    this.actions = new Map<string, ParsedFlow>();
    if (options.actions) {
      for (const a of options.actions) this.actions.set(a.id, a.flow);
    }
    this.catalogGlobals = options.catalogGlobals ?? {};
    this.knowledgeLoader = options.knowledgeLoader;
    this.getClassInfo = options.getClassInfo;
    this.loadClass = options.loadClass;
    this.agentTree = options.agentTree ?? "";
    this.knowledgeNamespacePrompt = options.knowledgeNamespacePrompt ?? "";
    this.rebuildKnowledgeTree = options.rebuildKnowledgeTree;
  }

  get debug(): boolean {
    return !!this.debugFile;
  }

  isRunning(): boolean {
    return this.running;
  }

  getActions(): Array<{ id: string; label: string; description: string }> {
    return [...this.actions.entries()].map(([id, flow]) => ({
      id,
      label: flow.name,
      description: flow.description,
    }));
  }

  /**
   * Replace the internal messages array.
   * Used by executeSpawn() to inject cloned parent messages into a child AgentLoop.
   * Only call before the first handleMessage().
   */
  setMessages(messages: ChatMessage[]): void {
    this.messages = messages;
  }

  /**
   * Spawn a child agent. Builds SpawnContext from stored references
   * and delegates to executeSpawn().
   */
  async handleSpawn(config: SpawnConfig): Promise<SpawnResult> {
    const ctx: SpawnContext = {
      model: this.model,
      modelId: this.modelId,
      messages: this.messages,
      scopeTable: this.session.getScopeTable(),
      catalogGlobals: this.catalogGlobals,
      functionSignatures: this.functionSignatures,
      formSignatures: this.formSignatures,
      viewSignatures: this.viewSignatures,
      classSignatures: this.classSignatures,
      knowledgeTree: this.knowledgeTree,
      knowledgeLoader: this.knowledgeLoader,
      getClassInfo: this.getClassInfo,
      loadClass: this.loadClass,
      parentSession: this.session,
    };
    return executeSpawn(config, ctx);
  }

  private logDebug(type: DebugEntry["type"], data: unknown): void {
    if (this.debug) this.debugLog.push({ timestamp: Date.now(), type, data });
  }

  /**
   * Handle a new user message — starts the LLM streaming cycle.
   */
  async handleMessage(text: string): Promise<void> {
    if (this.running) {
      // User intervention while running — handled by session
      console.log(`\n\x1b[33m[intervention]\x1b[0m ${text}`);
      this.session.handleIntervention(text);
      return;
    }

    // Check for slash action
    const slashMatch = text.match(/^\/(\S+)\s*(.*)$/);
    if (slashMatch) {
      const [, actionId, remaining] = slashMatch;
      const flow = this.actions.get(actionId);
      if (flow) {
        console.log(`\n\x1b[36m[action]\x1b[0m /${actionId} — ${flow.name}`);
        const tasklistCode = generateTasklistCode(flow, actionId);
        await this.runSetupCode(tasklistCode);
        // Continue with remaining text or a default message
        const message = remaining.trim() || `Execute the "${flow.name}" flow`;
        text = message;
      }
    }

    this.running = true;
    this.session.handleUserMessage(text);

    console.log(`\n\x1b[33m[user]\x1b[0m ${text}\n`);

    // Build initial system prompt
    const scope = this.session.getScopeTable();
    const classBlock = this.buildClassBlock();
    const pinnedBlock = this.buildPinnedBlock();
    const memoBlock = this.buildMemoBlock();
    const systemPrompt = buildSystemPrompt(
      this.functionSignatures,
      this.formSignatures,
      this.viewSignatures,
      classBlock,
      scope,
      this.instruct,
      this.knowledgeTree,
      this.agentTree,
      this.knowledgeNamespacePrompt,
      pinnedBlock || undefined,
      memoBlock || undefined,
    );

    // Initialize or update messages
    if (this.messages.length === 0) {
      this.messages.push({ role: "system", content: systemPrompt });
    } else {
      this.messages[0] = { role: "system", content: systemPrompt };
    }
    this.messages.push({ role: "user", content: text });

    this.logDebug("system_prompt", systemPrompt);
    this.logDebug("message", { role: "user", content: text });

    try {
      await this.runTurnLoop();
    } finally {
      this.running = false;
    }
  }

  /**
   * Run setup code before the first agent turn.
   * Feeds lines through the session as if the agent wrote them.
   */
  async runSetupCode(code: string): Promise<void> {
    // Initialize system prompt if needed
    if (this.messages.length === 0) {
      const scope = this.session.getScopeTable();
      const classBlock = this.buildClassBlock();
      const pinnedBlock = this.buildPinnedBlock();
      const memoBlock = this.buildMemoBlock();
      const systemPrompt = buildSystemPrompt(
        this.functionSignatures,
        this.formSignatures,
        this.viewSignatures,
        classBlock,
        scope,
        this.instruct,
        this.knowledgeTree,
        this.agentTree,
        this.knowledgeNamespacePrompt,
        pinnedBlock || undefined,
        memoBlock || undefined,
      );
      this.messages.push({ role: "system", content: systemPrompt });
    }

    console.log(`\x1b[90m--- setup ---\x1b[0m`);

    // Track stop/error from session events
    const state: { stop: StopPayload | null; error: ErrorPayload | null } = {
      stop: null,
      error: null,
    };
    const listener = (event: SessionEvent) => {
      this.logDebug("event", event);
      switch (event.type) {
        case "read":
          state.stop = {};
          for (const [k, v] of Object.entries(event.payload)) {
            state.stop[k] = { value: v, display: serialize(v as any) };
          }
          this.session.resolveStop();
          break;
        case "error":
          state.error = event.error;
          break;
        case "tasklist_declared":
          console.log(
            `\x1b[36m  [tasklist]\x1b[0m plan registered: [${event.tasklistId}] ${event.plan.description} (${event.plan.tasks.length} tasks)`,
          );
          break;
        case "task_complete":
          console.log(`\x1b[32m  [completeTask]\x1b[0m \u2713 ${event.tasklistId}/${event.id}`);
          break;
        case "task_failed":
          console.log(
            `\x1b[31m  [failTask]\x1b[0m ✗ ${event.tasklistId}/${event.id}: ${event.error}`,
          );
          break;
        case "task_skipped":
          console.log(
            `\x1b[90m  [skipped]\x1b[0m ⊘ ${event.tasklistId}/${event.id}: ${event.reason}`,
          );
          break;
        case "task_progress":
          console.log(
            `\x1b[36m  [progress]\x1b[0m ${event.tasklistId}/${event.id}: ${event.message}`,
          );
          break;
        case "display":
          console.log(`\x1b[35m  [display]\x1b[0m component rendered`);
          break;
        case "knowledge_loaded":
          console.log(`\x1b[36m  [knowledge]\x1b[0m loaded: ${event.domains.join(", ")}`);
          break;
        case "class_loaded":
          this.loadedClasses.add(event.className);
          console.log(
            `\x1b[36m  [loadClass]\x1b[0m ${event.className} \u2014 ${event.methods.length} method${event.methods.length !== 1 ? "s" : ""} loaded`,
          );
          break;
        case "agent_registered":
          console.log(`\x1b[36m  [agent]\x1b[0m registered: ${event.varName} — ${event.label}`);
          break;
        case "agent_resolved":
          console.log(`\x1b[32m  [agent]\x1b[0m resolved: ${event.varName}`);
          break;
        case "agent_failed":
          console.log(`\x1b[31m  [agent]\x1b[0m failed: ${event.varName} — ${event.error}`);
          break;
        case "agent_question_asked":
          console.log(
            `\x1b[33m  [agent]\x1b[0m ${event.varName} asks: "${event.question.message}"`,
          );
          break;
        case "agent_question_answered":
          console.log(`\x1b[32m  [agent]\x1b[0m ${event.varName} question answered`);
          break;
        case "knowledge_saved":
          console.log(
            `\x1b[36m  [knowledge]\x1b[0m saved: ${event.domain}/${event.field}/${event.option}`,
          );
          if (this.rebuildKnowledgeTree) this.knowledgeTree = this.rebuildKnowledgeTree();
          break;
        case "knowledge_removed":
          console.log(
            `\x1b[36m  [knowledge]\x1b[0m removed: ${event.domain}/${event.field}/${event.option}`,
          );
          if (this.rebuildKnowledgeTree) this.knowledgeTree = this.rebuildKnowledgeTree();
          break;
      }
    };
    this.session.on("event", listener);

    // Set session to executing state
    this.session.handleUserMessage("[setup]");

    // Feed code line by line
    const lines = code.split("\n");
    for (const line of lines) {
      if (state.stop || state.error) break;
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        process.stdout.write(`\x1b[32m${line}\x1b[0m\n`);
        await this.session.feedToken(line + "\n");
      } catch {
        // execution errors captured via event
      }
    }

    this.session.off("event", listener);

    // Finalize if no interruption
    if (!state.stop && !state.error) {
      try {
        await this.session.finalize();
      } catch {
        /* ignore */
      }
    }

    // Record as assistant message
    this.messages.push({ role: "assistant", content: code });
    this.logDebug("message", { role: "assistant", content: `[setup] ${code}` });

    // If stop occurred, record the stop message
    if (state.stop) {
      const entries = Object.entries(state.stop)
        .map(([k, v]) => `${k}: ${v.display}`)
        .join(", ");
      const stopMsg = `\u2190 stop { ${entries} }`;
      console.log(`\x1b[33m  [stop]\x1b[0m ${stopMsg}`);
      this.messages.push({ role: "user", content: stopMsg });
      this.logDebug("message", { role: "user", content: stopMsg });
    }

    if (state.error) {
      const errMsg = `\u2190 error [${state.error.type}] ${state.error.message} (line ${state.error.line})`;
      console.log(`\x1b[31m  [error]\x1b[0m ${errMsg}`);
      this.messages.push({ role: "user", content: errMsg });
      this.logDebug("message", { role: "user", content: errMsg });
    }

    // Refresh system prompt to reflect setup effects
    this.refreshSystemPrompt();
    console.log(`\x1b[90m--- setup complete ---\x1b[0m\n`);
  }

  private async runTurnLoop(): Promise<void> {
    let turn = 0;
    let proseNudges = 0;
    const maxProseNudges = 2;

    while (turn < this.maxTurns) {
      turn++;
      this.totalTurns++;

      console.log(`\x1b[90m--- turn ${turn} ---\x1b[0m`);
      this.logDebug("turn", { turn, messageCount: this.messages.length });

      // Track stop/error/violation/continuation from session events via mutable ref
      type TaskInfo = {
        tasklistId: string;
        readyTasks: Array<{
          id: string;
          instructions: string;
          outputSchema: Record<string, { type: string }>;
        }>;
      };
      const state: {
        stop: StopPayload | null;
        error: ErrorPayload | null;
        taskViolation: (TaskInfo & { attemptedTaskId: string }) | null;
        taskContinue: (TaskInfo & { completedTaskId: string }) | null;
      } = {
        stop: null,
        error: null,
        taskViolation: null,
        taskContinue: null,
      };

      const listener = (event: SessionEvent) => {
        this.logDebug("event", event);
        switch (event.type) {
          case "read":
            state.stop = {};
            for (const [k, v] of Object.entries(event.payload)) {
              state.stop[k] = { value: v, display: serialize(v as any) };
            }
            this.session.resolveStop();
            break;
          case "error":
            state.error = event.error;
            break;
          case "task_order_violation":
            state.taskViolation = {
              tasklistId: event.tasklistId,
              attemptedTaskId: event.attemptedTaskId,
              readyTasks: event.readyTasks,
            };
            console.log(
              `\x1b[31m  [task_order_violation]\x1b[0m tried "${event.attemptedTaskId}" in "${event.tasklistId}" — ready: ${event.readyTasks.map((t) => t.id).join(", ")}`,
            );
            break;
          case "task_complete_continue":
            state.taskContinue = {
              tasklistId: event.tasklistId,
              completedTaskId: event.completedTaskId,
              readyTasks: event.readyTasks,
            };
            console.log(
              `\x1b[36m  [continue]\x1b[0m ${event.tasklistId}/${event.completedTaskId} done — next: ${event.readyTasks.map((t) => t.id).join(", ")}`,
            );
            break;
          case "display":
            console.log(`\x1b[35m  [display]\x1b[0m component rendered`);
            break;
          case "async_start":
            console.log(`\x1b[34m  [async]\x1b[0m started: ${event.label}`);
            break;
          case "async_complete":
            console.log(
              `\x1b[34m  [async]\x1b[0m completed: ${event.taskId} (${(event.elapsed / 1000).toFixed(1)}s)`,
            );
            break;
          case "async_failed":
            console.log(`\x1b[31m  [async]\x1b[0m failed: ${event.taskId} — ${event.error}`);
            break;
          case "async_cancelled":
            console.log(`\x1b[33m  [async]\x1b[0m cancelled: ${event.taskId}`);
            break;
          case "tasklist_declared":
            console.log(
              `\x1b[36m  [tasklist]\x1b[0m plan registered: [${event.tasklistId}] ${event.plan.description} (${event.plan.tasks.length} tasks)`,
            );
            break;
          case "task_complete":
            console.log(`\x1b[32m  [completeTask]\x1b[0m ✓ ${event.tasklistId}/${event.id}`);
            break;
          case "task_failed":
            console.log(
              `\x1b[31m  [failTask]\x1b[0m ✗ ${event.tasklistId}/${event.id}: ${event.error}`,
            );
            break;
          case "task_retried":
            console.log(`\x1b[33m  [retryTask]\x1b[0m ↻ ${event.tasklistId}/${event.id}`);
            break;
          case "task_skipped":
            console.log(
              `\x1b[90m  [skipped]\x1b[0m ⊘ ${event.tasklistId}/${event.id}: ${event.reason}`,
            );
            break;
          case "task_progress":
            console.log(
              `\x1b[36m  [progress]\x1b[0m ${event.tasklistId}/${event.id}: ${event.message}${event.percent != null ? ` (${event.percent}%)` : ""}`,
            );
            break;
          case "task_async_start":
            console.log(`\x1b[34m  [taskAsync]\x1b[0m started: ${event.tasklistId}/${event.id}`);
            break;
          case "task_async_complete":
            console.log(`\x1b[32m  [taskAsync]\x1b[0m completed: ${event.tasklistId}/${event.id}`);
            break;
          case "task_async_failed":
            console.log(
              `\x1b[31m  [taskAsync]\x1b[0m failed: ${event.tasklistId}/${event.id}: ${event.error}`,
            );
            break;
          case "tasklist_reminder":
            console.log(
              `\x1b[33m  [system]\x1b[0m tasklist "${event.tasklistId}" reminder — ready: ${event.ready.join(", ")}${event.failed.length > 0 ? `, failed: ${event.failed.join(", ")}` : ""}`,
            );
            break;
          case "knowledge_loaded":
            console.log(`\x1b[36m  [knowledge]\x1b[0m loaded: ${event.domains.join(", ")}`);
            break;
          case "class_loaded":
            this.loadedClasses.add(event.className);
            console.log(
              `\x1b[36m  [loadClass]\x1b[0m ${event.className} — ${event.methods.length} method${event.methods.length !== 1 ? "s" : ""} loaded`,
            );
            break;
          case "hook":
            console.log(
              `\x1b[35m  [hook]\x1b[0m ${event.hookId} → ${event.action}: ${event.detail}`,
            );
            break;
          case "agent_registered":
            console.log(`\x1b[36m  [agent]\x1b[0m registered: ${event.varName} — ${event.label}`);
            break;
          case "agent_resolved":
            console.log(`\x1b[32m  [agent]\x1b[0m resolved: ${event.varName}`);
            break;
          case "agent_failed":
            console.log(`\x1b[31m  [agent]\x1b[0m failed: ${event.varName} — ${event.error}`);
            break;
          case "agent_question_asked":
            console.log(
              `\x1b[33m  [agent]\x1b[0m ${event.varName} asks: "${event.question.message}"`,
            );
            break;
          case "agent_question_answered":
            console.log(`\x1b[32m  [agent]\x1b[0m ${event.varName} question answered`);
            break;
          case "knowledge_saved":
            console.log(
              `\x1b[36m  [knowledge]\x1b[0m saved: ${event.domain}/${event.field}/${event.option}`,
            );
            if (this.rebuildKnowledgeTree) this.knowledgeTree = this.rebuildKnowledgeTree();
            break;
          case "knowledge_removed":
            console.log(
              `\x1b[36m  [knowledge]\x1b[0m removed: ${event.domain}/${event.field}/${event.option}`,
            );
            if (this.rebuildKnowledgeTree) this.knowledgeTree = this.rebuildKnowledgeTree();
            break;
          case "status":
            // don't log status changes to console, they're noisy
            break;
        }
      };
      this.session.on("event", listener);

      // Step 1: Stream entire LLM response, printing as it arrives
      let code = "";
      let streamResult: ReturnType<typeof streamText> | null = null;
      try {
        streamResult = streamText({
          model: this.model,
          messages: this.messages.map((m) => ({ role: m.role, content: m.content })),
          temperature: 0.2,
          maxOutputTokens: 4096,
        });

        for await (const chunk of streamResult.textStream) {
          process.stdout.write(`\x1b[32m${chunk}\x1b[0m`);
          code += chunk;
        }
        console.log(); // newline after streamed code

        // Collect usage metadata for debug
        if (this.debug) {
          try {
            const [usage, finishReason, response] = await Promise.all([
              streamResult.usage,
              streamResult.finishReason,
              streamResult.response,
            ]);
            this.tokenTotals.inputTokens += usage.inputTokens ?? 0;
            this.tokenTotals.outputTokens += usage.outputTokens ?? 0;
            this.tokenTotals.totalTokens += usage.totalTokens ?? 0;
            this.logDebug("turn_result", {
              turn,
              finishReason,
              usage: {
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
                totalTokens: usage.totalTokens,
                inputTokenDetails: usage.inputTokenDetails,
                outputTokenDetails: usage.outputTokenDetails,
              },
              response: {
                id: response.id,
                modelId: response.modelId,
                timestamp: response.timestamp,
              },
            });
          } catch {
            /* usage metadata optional */
          }
        }
      } catch (err: any) {
        console.error(`\n\x1b[31m  [api error]\x1b[0m ${err.message}`);
        this.logDebug("api_error", { message: err.message, stack: err.stack });
        this.session.off("event", listener);
        break;
      }

      // Step 2: Clean model output
      const rawCode = code;
      code = cleanCode(code);

      // Step 2b: Detect prose-only output (agent forgot it's a REPL)
      // Comments (//) are the agent's speech — valid TypeScript, not prose.
      // Only nudge when cleanCode stripped everything (actual natural language).
      const nonEmptyLines = code.split("\n").filter((l) => l.trim());
      const hasAnyContent = nonEmptyLines.length > 0;
      if (!hasAnyContent) {
        proseNudges++;
        if (proseNudges > maxProseNudges) {
          console.log(
            `\x1b[31m  [abort]\x1b[0m agent wrote prose ${proseNudges} times — giving up`,
          );
          this.messages.push({ role: "assistant", content: rawCode });
          break;
        }
        const nudge =
          "⚠ [system] You are a code-execution agent in a live TypeScript REPL. " +
          "Do NOT write prose or natural language. Output ONLY valid TypeScript code. " +
          "Every character you emit is executed. Re-read the system prompt and try again.";
        console.log(
          `\x1b[33m  [nudge]\x1b[0m prose detected — reminding agent to write TypeScript`,
        );
        this.messages.push({ role: "assistant", content: rawCode });
        this.messages.push({ role: "user", content: nudge });
        this.logDebug("message", { role: "assistant", content: rawCode });
        this.logDebug("message", { role: "user", content: nudge });
        continue;
      }

      // Step 3: Feed cleaned code to session line by line
      const lines = code.split("\n");
      for (const line of lines) {
        if (state.stop || state.error || state.taskViolation || state.taskContinue) break;
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          await this.session.feedToken(line + "\n");
        } catch {
          // execution errors captured via event
        }
      }

      this.session.off("event", listener);

      // Step 4: Flush remaining buffer if no interruption
      let tasklistIncomplete = false;
      if (!state.stop && !state.error && !state.taskViolation && !state.taskContinue) {
        try {
          const result = await this.session.finalize();
          if (result === "tasklist_incomplete") {
            tasklistIncomplete = true;
          }
        } catch {
          /* ignore */
        }
      }

      // Handle tasklist incomplete → inject reminder and loop
      if (tasklistIncomplete) {
        this.refreshSystemPrompt();
        const sessionMsgs = this.session.getMessages();
        const reminderMsg = sessionMsgs[sessionMsgs.length - 1];
        this.messages.push({ role: "assistant", content: code });
        this.messages.push({ role: "user", content: reminderMsg.content });
        this.logDebug("message", { role: "assistant", content: code });
        this.logDebug("message", { role: "user", content: reminderMsg.content });
        this.logDebug("scope", this.session.snapshot().scope);
        continue;
      }

      // Handle task complete with remaining tasks → inject next task guidance and loop
      if (state.taskContinue) {
        const cpState = this.session.snapshot().tasklistsState;
        const continueMsg = buildTaskContinueMessage(
          state.taskContinue.tasklistId,
          state.taskContinue.completedTaskId,
          state.taskContinue.readyTasks,
          cpState,
        );

        this.messages.push({ role: "assistant", content: code });
        this.messages.push({ role: "user", content: continueMsg });
        this.refreshSystemPrompt();
        this.logDebug("message", { role: "assistant", content: code });
        this.logDebug("message", { role: "user", content: continueMsg });
        this.logDebug("scope", this.session.snapshot().scope);
        continue;
      }

      // Handle stop → inject as user message and loop
      if (state.stop) {
        // Extract retention hint if present (_retain key)
        let retainHint: 'high' | 'low' | undefined;
        if ('_retain' in state.stop) {
          const retainVal = state.stop._retain?.value;
          if (retainVal === 'high' || retainVal === 'low') {
            retainHint = retainVal;
          }
          delete state.stop._retain;
        }

        const entries = Object.entries(state.stop)
          .map(([k, v]) => `${k}: ${v.display}`)
          .join(", ");
        let stopMsg = `← stop { ${entries} }`;

        // Append {{TASKS}} block and current task instructions when tasklists are active
        const cpState = this.session.snapshot().tasklistsState;
        const tasksBlock = generateTasksBlock(cpState);
        if (tasksBlock) stopMsg += `\n\n${tasksBlock}`;
        const currentTaskBlock = generateCurrentTaskBlock(cpState);
        if (currentTaskBlock) stopMsg += `\n\n${currentTaskBlock}`;

        // Append {{AGENTS}} block if there are visible agent entries
        const agentRegistry = this.session.getAgentRegistry();
        if (agentRegistry.hasVisibleEntries()) {
          const resolvedInThisStop = new Set<string>();
          for (const [, sv] of Object.entries(state.stop)) {
            const entry = agentRegistry.findByPromise(sv.value);
            if (entry?.status === "resolved") resolvedInThisStop.add(entry.varName);
          }
          const agentsBlock = generateAgentsBlock(agentRegistry, resolvedInThisStop);
          if (agentsBlock) stopMsg += `\n\n${agentsBlock}`;
        }

        console.log(`\x1b[33m  [stop]\x1b[0m ${stopMsg}`);

        const codeUpToStop = truncateAtStop(code);
        this.messages.push({ role: "assistant", content: codeUpToStop });
        this.messages.push({ role: "user", content: stopMsg });

        // Track retention hint for adaptive decay
        if (retainHint) {
          this.stopRetentionHints.set(this.messages.length - 1, retainHint);
        }

        // Track knowledge-containing stops for progressive decay
        const knowledgeKeys = new Set<string>();
        const knowledgeContent = new Map<string, KnowledgeContent>();
        for (const [k, v] of Object.entries(state.stop)) {
          if (isKnowledgeContent(v.value)) {
            knowledgeKeys.add(k);
            knowledgeContent.set(k, v.value as KnowledgeContent);
          }
        }
        if (knowledgeKeys.size > 0) {
          this.knowledgeStops.push({
            messageIndex: this.messages.length - 1,
            turn: this.totalTurns,
            payload: state.stop,
            knowledgeKeys,
            knowledgeContent,
          });
        }

        this.refreshSystemPrompt();
        this.logDebug("message", { role: "assistant", content: codeUpToStop });
        this.logDebug("message", { role: "user", content: stopMsg });
        this.logDebug("scope", this.session.snapshot().scope);
        continue;
      }

      // Handle task order violation → inject guidance and loop (takes priority over generic error)
      if (state.taskViolation) {
        const cpState = this.session.snapshot().tasklistsState;
        const violationMsg = buildTaskOrderViolationMessage(
          state.taskViolation.tasklistId,
          state.taskViolation.attemptedTaskId,
          state.taskViolation.readyTasks,
          cpState,
        );
        console.log(`\x1b[31m  [violation]\x1b[0m ${violationMsg.split("\n")[0]}`);

        this.messages.push({ role: "assistant", content: code });
        this.messages.push({ role: "user", content: violationMsg });
        this.refreshSystemPrompt();
        this.logDebug("message", { role: "assistant", content: code });
        this.logDebug("message", { role: "user", content: violationMsg });
        this.logDebug("scope", this.session.snapshot().scope);
        continue;
      }

      // Handle error → inject as user message and loop
      if (state.error) {
        const errMsg = `← error [${state.error.type}] ${state.error.message} (line ${state.error.line})`;
        console.log(`\x1b[31m  [error]\x1b[0m ${errMsg}`);

        this.messages.push({ role: "assistant", content: code });
        this.messages.push({ role: "user", content: errMsg });
        this.refreshSystemPrompt();
        this.logDebug("message", { role: "assistant", content: code });
        this.logDebug("message", { role: "user", content: errMsg });
        this.logDebug("scope", this.session.snapshot().scope);
        continue;
      }

      // No stop/error — LLM finished naturally
      this.messages.push({ role: "assistant", content: code });
      this.logDebug("message", { role: "assistant", content: code });
      this.logDebug("scope", this.session.snapshot().scope);
      console.log(`\x1b[36m[done]\x1b[0m Turn loop finished (${turn} turn(s))`);
      break;
    }

    if (turn >= this.maxTurns) {
      console.log(`\x1b[33m[limit]\x1b[0m Reached max turns (${this.maxTurns})`);
    }

    // Print tasklist summary
    const cpState = this.session.snapshot().tasklistsState;
    if (cpState.tasklists.size > 0) {
      console.log(`\n\x1b[36m━━━ Tasklists ━━━\x1b[0m`);
      for (const [tasklistId, tasklist] of cpState.tasklists) {
        const total = tasklist.plan.tasks.length;
        const done = [...tasklist.completed.values()].filter(
          (c) => c.status === "completed",
        ).length;
        const failed = [...tasklist.completed.values()].filter((c) => c.status === "failed").length;
        const skipped = [...tasklist.completed.values()].filter(
          (c) => c.status === "skipped",
        ).length;
        console.log(
          `\x1b[36m[${tasklistId}]\x1b[0m ${tasklist.plan.description} — ${done}/${total} complete${failed ? `, ${failed} failed` : ""}${skipped ? `, ${skipped} skipped` : ""}`,
        );
        for (const task of tasklist.plan.tasks) {
          const completion = tasklist.completed.get(task.id);
          if (completion?.status === "completed") {
            console.log(`  \x1b[32m✓\x1b[0m ${task.id}: ${JSON.stringify(completion.output)}`);
          } else if (completion?.status === "failed") {
            console.log(`  \x1b[31m✗\x1b[0m ${task.id}: failed — ${completion.error}`);
          } else if (completion?.status === "skipped") {
            console.log(`  \x1b[90m⊘\x1b[0m ${task.id}: skipped`);
          } else if (tasklist.runningTasks.has(task.id)) {
            console.log(`  \x1b[34m◉\x1b[0m ${task.id}: running`);
          } else if (tasklist.readyTasks.has(task.id)) {
            console.log(`  \x1b[33m◎\x1b[0m ${task.id}: ready`);
          } else {
            console.log(`  \x1b[90m○\x1b[0m ${task.id}: pending`);
          }
        }
      }
    }

    // Print agent summary
    const agentEntries = this.session.snapshot().agentEntries;
    if (agentEntries.length > 0) {
      console.log(`\n\x1b[36m━━━ Agents ━━━\x1b[0m`);
      for (const e of agentEntries) {
        const symbol =
          e.status === "resolved"
            ? "✓"
            : e.status === "failed"
              ? "✗"
              : e.status === "waiting"
                ? "?"
                : "◉";
        const color = e.status === "resolved" ? "32" : e.status === "failed" ? "31" : "36";
        console.log(
          `  \x1b[${color}m${symbol}\x1b[0m ${e.varName}: ${e.label} — ${e.status}${e.error ? ` — ${e.error}` : ""}`,
        );
      }
    }

    // Write debug log
    this.writeDebugLog();

    console.log(`\n\x1b[90m[waiting] Ready for follow-up messages via chat UI\x1b[0m`);
  }

  private buildClassBlock(): string {
    if (this.classExports.length === 0) return this.classSignatures;
    const blocks: string[] = [];
    for (const cls of this.classExports) {
      if (this.loadedClasses.has(cls.name)) {
        blocks.push(formatExpandedClass(cls));
      } else {
        blocks.push(formatCollapsedClass(cls));
      }
    }
    return blocks.filter(Boolean).join("\n");
  }

  private buildPinnedBlock(): string {
    const pinned = this.session.getPinnedMemory();
    if (pinned.size === 0) return "";
    const lines: string[] = [];
    for (const [key, entry] of pinned) {
      lines.push(`${key}: ${entry.display}`);
    }
    return lines.join("\n");
  }

  private buildMemoBlock(): string {
    const memos = this.session.getMemoMemory();
    if (memos.size === 0) return "";
    const lines: string[] = [];
    for (const [key, value] of memos) {
      lines.push(`[${key}] ${value}`);
    }
    return lines.join("\n");
  }

  private refreshSystemPrompt(): void {
    const scope = this.session.getScopeTable();
    const classBlock = this.buildClassBlock();
    const pinnedBlock = this.buildPinnedBlock();
    const memoBlock = this.buildMemoBlock();
    const systemPrompt = buildSystemPrompt(
      this.functionSignatures,
      this.formSignatures,
      this.viewSignatures,
      classBlock,
      scope,
      this.instruct,
      this.knowledgeTree,
      this.agentTree,
      this.knowledgeNamespacePrompt,
      pinnedBlock || undefined,
      memoBlock || undefined,
    );
    this.messages[0] = { role: "system", content: systemPrompt };
    this.logDebug("system_prompt", systemPrompt);

    // Apply progressive decay to knowledge-containing stop messages
    this.decayKnowledgeMessages();
  }

  /**
   * Rebuild older knowledge-containing stop messages with progressively
   * truncated content to conserve context window space.
   */
  private decayKnowledgeMessages(): void {
    for (const ks of this.knowledgeStops) {
      let distance = this.totalTurns - ks.turn;
      if (distance <= 0) continue;

      // Apply adaptive decay multiplier from retention hints
      const retainHint = this.stopRetentionHints.get(ks.messageIndex);
      if (retainHint === 'high') {
        distance = Math.floor(distance / 2); // decay half as fast
      } else if (retainHint === 'low') {
        distance = distance * 2; // decay twice as fast
      }

      // Rebuild the stop message with decayed knowledge values
      const entries = Object.entries(ks.payload).map(([k, v]) => {
        if (ks.knowledgeKeys.has(k)) {
          const content = ks.knowledgeContent.get(k)!;
          const decayed = decayKnowledgeValue(content, distance);
          return `${k}: ${decayed}`;
        }
        return `${k}: ${v.display}`;
      });
      this.messages[ks.messageIndex] = {
        role: "user",
        content: `← stop { ${entries.join(", ")} }`,
      };
    }
  }

  /**
   * Compute a context budget snapshot for the agent's contextBudget() global.
   */
  getContextBudget(): ContextBudgetSnapshot {
    // Rough token estimate: ~4 chars per token
    const estimateTokens = (s: string) => Math.ceil(s.length / 4);
    const maxTokens = 100_000; // default context window

    const systemPromptTokens = this.messages.length > 0
      ? estimateTokens(this.messages[0].content)
      : 0;
    let messageHistoryTokens = 0;
    for (let i = 1; i < this.messages.length; i++) {
      messageHistoryTokens += estimateTokens(this.messages[i].content);
    }
    const usedTokens = systemPromptTokens + messageHistoryTokens;
    const remainingTokens = Math.max(0, maxTokens - usedTokens);

    // Determine current decay levels based on turn count
    let stopDecay: string = 'full';
    if (this.totalTurns > 10) stopDecay = 'removed';
    else if (this.totalTurns > 5) stopDecay = 'count';
    else if (this.totalTurns > 2) stopDecay = 'keys';

    let knowledgeDecay: string = 'full';
    if (this.totalTurns > 4) knowledgeDecay = 'names';
    else if (this.totalTurns > 2) knowledgeDecay = 'headers';
    else if (this.totalTurns > 0) knowledgeDecay = 'truncated';

    const ratio = usedTokens / maxTokens;
    const recommendation: 'nominal' | 'conserve' | 'critical' =
      ratio > 0.85 ? 'critical' : ratio > 0.6 ? 'conserve' : 'nominal';

    return {
      totalTokens: maxTokens,
      usedTokens,
      remainingTokens,
      systemPromptTokens,
      messageHistoryTokens,
      turnNumber: this.totalTurns,
      decayLevel: { stops: stopDecay, knowledge: knowledgeDecay },
      recommendation,
    };
  }

  /**
   * Handle a reflect() call — makes a separate LLM call for self-evaluation.
   */
  async handleReflect(request: ReflectRequest): Promise<ReflectResult> {
    const criteria = request.criteria ?? ["correctness", "efficiency", "completeness"];
    const contextStr = request.context
      ? Object.entries(request.context)
          .map(([k, v]) => `${k}: ${JSON.stringify(v, null, 2).slice(0, 500)}`)
          .join("\n")
      : "(no context provided)";

    const reflectionPrompt = `You are a code review assistant. Evaluate the following question about an agent's approach.

Question: ${request.question}

Context:
${contextStr}

Current SCOPE:
${this.session.getScopeTable()}

Evaluate on these criteria: ${criteria.join(", ")}

Respond with ONLY valid JSON (no markdown, no prose):
{
  "assessment": "brief assessment string",
  "scores": { ${criteria.map((c) => `"${c}": 0.0`).join(", ")} },
  "suggestions": ["suggestion1", "suggestion2"],
  "shouldPivot": false
}`;

    try {
      const result = streamText({
        model: this.model,
        messages: [
          { role: "system", content: "You are a concise code review assistant. Respond only with valid JSON." },
          { role: "user", content: reflectionPrompt },
        ],
        temperature: 0.1,
        maxOutputTokens: 1024,
      });

      let text = "";
      for await (const chunk of result.textStream) {
        text += chunk;
      }

      // Parse JSON from response (strip markdown fences if present)
      const jsonStr = text.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();
      const parsed = JSON.parse(jsonStr);
      return {
        assessment: parsed.assessment ?? "No assessment",
        scores: parsed.scores ?? {},
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        shouldPivot: !!parsed.shouldPivot,
      };
    } catch (err: any) {
      return {
        assessment: `Reflection failed: ${err.message}`,
        scores: {},
        suggestions: [],
        shouldPivot: false,
      };
    }
  }

  private writeDebugLog(): void {
    if (!this.debug || !this.debugFile) return;

    const snapshot = this.session.snapshot();
    this.logDebug("finalize", {
      model: this.modelId,
      turns: this.totalTurns,
      maxTurns: this.maxTurns,
      status: snapshot.status,
      tokenTotals: this.tokenTotals,
      scope: snapshot.scope,
      tasklistsState:
        snapshot.tasklistsState.tasklists.size > 0
          ? Object.fromEntries(
              [...snapshot.tasklistsState.tasklists].map(([id, tl]) => [
                id,
                {
                  description: tl.plan.description,
                  tasks: tl.plan.tasks,
                  completed: Object.fromEntries(tl.completed),
                  readyTasks: [...tl.readyTasks],
                  runningTasks: [...tl.runningTasks],
                },
              ]),
            )
          : null,
      messages: this.messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const isXml = /\.xml$/i.test(this.debugFile);
    const output = isXml ? debugLogToXml(this.debugLog) : JSON.stringify(this.debugLog, null, 2);
    writeFileSync(resolve(this.debugFile), output, "utf-8");
    console.log(`\x1b[90m[debug] Written to ${this.debugFile}\x1b[0m`);
  }
}

// ── Utilities ──

function cleanCode(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^```(?:typescript|ts|tsx|javascript|js)?\s*\n?/, "");
  s = s.replace(/\n?```\s*$/, "");
  s = s.replace(/<think>[\s\S]*?<\/think>/g, "");
  s = s.replace(/<\/?think>/g, "");
  const lines = s.split("\n");
  const cleaned = lines.filter((line) => {
    const t = line.trim();
    if (!t) return true;
    if (t.startsWith("//")) return true;
    if (
      /^[A-Z][a-z]/.test(t) &&
      !t.startsWith("React") &&
      !t.startsWith("Promise") &&
      !t.startsWith("Array") &&
      !t.startsWith("Object") &&
      !t.startsWith("Map") &&
      !t.startsWith("Set") &&
      !t.startsWith("Date") &&
      !t.startsWith("Error") &&
      !t.startsWith("String") &&
      !t.startsWith("Number") &&
      !t.startsWith("Boolean")
    ) {
      return false;
    }
    if (t.startsWith("←")) return false;
    if (/^(Now |Let me |I |Good|Great|Here|The |This |Next|From |Total|Summary)/.test(t))
      return false;
    if (/^\d+\.\s+[A-Z]/.test(t) || /^-\s+[A-Z]/.test(t)) return false;
    return true;
  });
  return cleaned.join("\n");
}

function truncateAtStop(code: string): string {
  const lines = code.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes("await stop(") || lines[i].includes("stop(")) {
      return lines.slice(0, i + 1).join("\n");
    }
  }
  return code;
}

// ── XML Debug Serializer ──

function xmlAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function toYaml(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  if (value === null || value === undefined) return `${pad}null`;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return `${pad}${value}`;
  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}[]`;
    return value
      .map((item) => {
        const inner = toYaml(item, indent + 1).trimStart();
        return `${pad}- ${inner}`;
      })
      .join("\n");
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) return `${pad}{}`;
    return keys
      .map((key) => {
        const v = obj[key];
        if (v && typeof v === "object") return `${pad}${key}:\n${toYaml(v, indent + 1)}`;
        return `${pad}${key}: ${String(v ?? "null")}`;
      })
      .join("\n");
  }
  return `${pad}${String(value)}`;
}

/** Indent every non-empty line of `text` with `prefix`. Empty lines stay empty. */
function indentBlock(text: string, prefix: string): string {
  return text
    .split("\n")
    .map((l) => (l.trim() ? `${prefix}${l}` : ""))
    .join("\n");
}

function formatMessage(d: any, prefix: string): string {
  const content = String(d.content ?? "");
  const inner = prefix + "  ";
  // Convert stop payloads from JSON to YAML
  const stopMatch = content.match(/^← stop ([\s\S]+)$/);
  if (stopMatch) {
    try {
      const parsed = JSON.parse(stopMatch[1]);
      return `${prefix}<message role="${xmlAttr(d.role)}">\n${indentBlock(toYaml(parsed), inner)}\n${prefix}</message>`;
    } catch {
      /* fall through */
    }
  }
  return `${prefix}<message role="${xmlAttr(d.role)}">\n${indentBlock(content, inner)}\n${prefix}</message>`;
}

function formatScope(d: any, prefix: string): string | null {
  const entries = Array.isArray(d) ? d : [];
  if (entries.length === 0) return null;
  const inner = prefix + "  ";
  const vars = entries.map((e: any) => `${inner}${e.name}: ${e.type} ${e.value}`).join("\n");
  return `${prefix}<scope>\n${vars}\n${prefix}</scope>`;
}

function formatUsage(d: any, prefix: string): string {
  const u = d.usage ?? {};
  const cacheRead = u.inputTokenDetails?.cacheReadTokens ?? 0;
  const reasoning = u.outputTokenDetails?.reasoningTokens ?? 0;
  return `${prefix}<usage input="${u.inputTokens ?? 0}" output="${u.outputTokens ?? 0}" total="${u.totalTokens ?? 0}" reasoning="${reasoning}" cache-read="${cacheRead}" />`;
}

/**
 * Compute a line-level diff between two multi-line strings.
 * Returns XML using <del>/<ins> elements for removed/added lines,
 * with unchanged context lines shown around each changed hunk.
 */
function lineDiff(oldText: string, newText: string, ctx = 3): string {
  if (oldText === newText) return "(no changes)";

  const a = oldText.split("\n");
  const b = newText.split("\n");
  const m = a.length;
  const n = b.length;

  // Normalize whitespace for comparison: collapse runs of spaces/tabs to single space, trim.
  // This prevents table re-alignment (e.g. SCOPE column widths) from showing as changes.
  const norm = (s: string) => s.replace(/[\t ]+/g, " ").trim();
  const aN = a.map(norm);
  const bN = b.map(norm);

  // O(mn) LCS table using normalized lines
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        aN[i - 1] === bN[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack to build edit script (output uses new version's line for equal matches)
  type Op = "equal" | "delete" | "insert";
  const ops: { type: Op; line: string }[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aN[i - 1] === bN[j - 1]) {
      ops.unshift({ type: "equal", line: b[j - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: "insert", line: b[j - 1] });
      j--;
    } else {
      ops.unshift({ type: "delete", line: a[i - 1] });
      i--;
    }
  }

  // Collect indices of changed ops
  const changes: number[] = [];
  for (let k = 0; k < ops.length; k++) {
    if (ops[k].type !== "equal") changes.push(k);
  }
  if (changes.length === 0) return "(no changes)";

  // Group nearby changes into hunks
  const hunks: { start: number; end: number }[] = [];
  let hStart = changes[0];
  let hEnd = changes[0];
  for (let k = 1; k < changes.length; k++) {
    if (changes[k] - hEnd <= ctx * 2 + 1) {
      hEnd = changes[k];
    } else {
      hunks.push({ start: hStart, end: hEnd });
      hStart = changes[k];
      hEnd = changes[k];
    }
  }
  hunks.push({ start: hStart, end: hEnd });

  // Format hunks with <del>/<ins> elements and context lines
  const out: string[] = [];
  for (let h = 0; h < hunks.length; h++) {
    const hunk = hunks[h];
    const start = Math.max(0, hunk.start - ctx);
    const end = Math.min(ops.length - 1, hunk.end + ctx);

    if (h === 0 && start > 0) out.push(`... (${start} unchanged lines)`);
    for (let k = start; k <= end; k++) {
      const op = ops[k];
      switch (op.type) {
        case "equal":
          out.push(op.line);
          break;
        case "delete":
          out.push(`<del>${op.line}</del>`);
          break;
        case "insert":
          out.push(`<ins>${op.line}</ins>`);
          break;
      }
    }
    // Separator between hunks or trailing ellipsis
    const nextStart = h + 1 < hunks.length ? Math.max(0, hunks[h + 1].start - ctx) : ops.length;
    const gap = nextStart - end - 1;
    if (gap > 0) out.push(`... (${gap} unchanged lines)`);
  }

  return out.join("\n");
}

function debugLogToXml(entries: DebugEntry[]): string {
  const out: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', "<debug-log>", ""];

  // Indentation prefixes: L1 = child of <debug-log>, L2 = child of <turn>
  const L1 = "  ";
  const L2 = "    ";

  // Group entries into turns. Pre-turn entries (system_prompt, setup messages) go
  // into a "setup" section. Each 'turn' marker starts a new group that collects
  // its messages, scope, turn_result, and errors until the next turn marker.

  let inTurn = false;
  let turnAttrs = "";
  let firstTurnPrompt: string | null = null; // baseline for diffing

  for (const entry of entries) {
    const d = entry.data as any;

    switch (entry.type) {
      case "system_prompt": {
        const tag = inTurn ? L2 : L1;
        const contentPrefix = inTurn ? L2 + "  " : L1 + "  ";

        if (!inTurn) {
          // Pre-turn system prompts — always show in full
          out.push(
            `${tag}<system-prompt>`,
            indentBlock(d, contentPrefix),
            `${tag}</system-prompt>`,
            "",
          );
        } else if (firstTurnPrompt === null) {
          // First turn — show full and save as baseline
          firstTurnPrompt = d;
          out.push(
            `${tag}<system-prompt>`,
            indentBlock(d, contentPrefix),
            `${tag}</system-prompt>`,
            "",
          );
        } else {
          // Subsequent turns — show diff from first turn's prompt
          const diff = lineDiff(firstTurnPrompt, d);
          out.push(
            `${tag}<system-prompt diff="true">`,
            indentBlock(diff, contentPrefix),
            `${tag}</system-prompt>`,
            "",
          );
        }
        break;
      }

      case "turn":
        // Close previous turn if open
        if (inTurn) out.push(`${L1}</turn>`, "");
        turnAttrs = `n="${d.turn}" messages="${d.messageCount}"`;
        inTurn = true;
        // Don't emit opening tag yet — wait for turn_result to add finish/model attrs
        break;

      case "turn_result": {
        const model = d.response?.modelId ?? "";
        const finish = xmlAttr(String(d.finishReason ?? ""));
        out.push(`${L1}<turn ${turnAttrs} finish="${finish}" model="${xmlAttr(model)}">`);
        out.push(formatUsage(d, L2));
        break;
      }

      case "message":
        if (!inTurn) {
          out.push(formatMessage(d, L1), "");
        } else {
          out.push(formatMessage(d, L2));
        }
        break;

      case "scope": {
        const s = formatScope(d, inTurn ? L2 : L1);
        if (s) out.push(s);
        break;
      }

      case "event":
        break;

      case "api_error":
        out.push(`${inTurn ? L2 : L1}<api-error>${d.message ?? ""}</api-error>`);
        break;

      case "finalize": {
        if (inTurn) {
          out.push(`${L1}</turn>`, "");
          inTurn = false;
        }
        const t = d.tokenTotals ?? {};
        out.push(
          `${L1}<finalize model="${xmlAttr(d.model ?? "")}" turns="${d.turns}" status="${xmlAttr(d.status ?? "")}">`,
          `${L2}<tokens input="${t.inputTokens ?? 0}" output="${t.outputTokens ?? 0}" total="${t.totalTokens ?? 0}" />`,
          `${L1}</finalize>`,
          "",
        );
        break;
      }

      default:
        break;
    }
  }

  if (inTurn) out.push(`${L1}</turn>`, "");
  out.push("</debug-log>");
  return out.join("\n");
}
