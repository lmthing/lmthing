/**
 * Spawn infrastructure — child agent session factory and execution.
 *
 * Creates a child Session + AgentLoop, runs a directive, and extracts
 * structured output from the child's last stop() call.
 */

import type { LanguageModel } from "ai";
import { Session } from "../session/session";
import type { SessionOptions } from "../session/session";
import type { SessionEvent } from "../session/types";
import { AgentLoop } from "../cli/agent-loop";
import type { ChatMessage } from "../cli/agent-loop";
import { buildSystemPrompt } from "../cli/buildSystemPrompt";

// ── Types ──

export interface SpawnConfig {
  directive: string;
  context: "empty" | "branch";
  maxTurns?: number;
  instruct?: string;
}

export interface SpawnResult {
  scope: string;
  result: unknown;
  keyFiles: string[];
  issues?: string[];
  _raw?: Record<string, unknown>;
  _meta: { context: "empty" | "branch"; turns: number; duration: number };
}

export interface SpawnContext {
  model: LanguageModel;
  modelId: string;
  messages: ChatMessage[];
  scopeTable: string;
  catalogGlobals: Record<string, unknown>;
  functionSignatures: string;
  formSignatures: string;
  viewSignatures: string;
  classSignatures: string;
  knowledgeTree: string;
  knowledgeLoader?: SessionOptions["knowledgeLoader"];
  getClassInfo?: SessionOptions["getClassInfo"];
  loadClass?: SessionOptions["loadClass"];
  parentSession: Session;
}

// ── Execution ──

export async function executeSpawn(
  config: SpawnConfig,
  ctx: SpawnContext,
): Promise<SpawnResult> {
  const childId = `spawn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const startTime = Date.now();

  // Emit spawn_start on parent
  ctx.parentSession.emit("event", {
    type: "spawn_start",
    childId,
    context: config.context,
    directive: config.directive,
  } satisfies SessionEvent);

  let childSession: Session | null = null;

  try {
    // Create child session with parent's globals and callbacks
    childSession = new Session({
      globals: { ...ctx.catalogGlobals },
      knowledgeLoader: ctx.knowledgeLoader,
      getClassInfo: ctx.getClassInfo,
      loadClass: ctx.loadClass,
    });

    // Build child instruct with structured output requirement
    const childInstruct = buildChildInstruct(
      ctx.scopeTable,
      config.instruct,
    );

    // Create child AgentLoop
    const childAgentLoop = new AgentLoop({
      session: childSession,
      model: ctx.model,
      modelId: ctx.modelId,
      instruct: childInstruct,
      functionSignatures: ctx.functionSignatures || undefined,
      formSignatures: ctx.formSignatures || undefined,
      viewSignatures: ctx.viewSignatures || undefined,
      classSignatures: ctx.classSignatures || undefined,
      knowledgeTree: ctx.knowledgeTree || undefined,
      maxTurns: config.maxTurns ?? 5,
    });

    // If branch context, clone parent messages into child
    if (config.context === "branch") {
      const clonedMessages = structuredClone(ctx.messages);
      childAgentLoop.setMessages(clonedMessages);
    }

    // Track the last stop payload via events
    let lastPayload: Record<string, unknown> | null = null;
    let turnCount = 0;
    childSession.on("event", (event: SessionEvent) => {
      if (event.type === "read") {
        lastPayload = event.payload;
      }
    });

    // Run the directive
    await childAgentLoop.handleMessage(config.directive);

    // Count turns from child messages (assistant messages = turns)
    const childMessages = childSession.getMessages();
    turnCount = childMessages.filter((m) => m.role === "assistant").length;

    // Build SpawnResult from last stop payload
    const duration = Date.now() - startTime;
    const result = buildSpawnResult(lastPayload, config.context, turnCount, duration);

    // Emit spawn_complete on parent
    ctx.parentSession.emit("event", {
      type: "spawn_complete",
      childId,
      turns: turnCount,
      duration,
    } satisfies SessionEvent);

    return result;
  } catch (err: any) {
    const duration = Date.now() - startTime;
    const errorMsg = err?.message ?? String(err);

    // Emit spawn_error on parent
    ctx.parentSession.emit("event", {
      type: "spawn_error",
      childId,
      error: errorMsg,
    } satisfies SessionEvent);

    // Return best-effort result
    return {
      scope: "error",
      result: null,
      keyFiles: [],
      issues: [errorMsg],
      _meta: { context: config.context, turns: 0, duration },
    };
  } finally {
    childSession?.destroy();
  }
}

// ── Helpers ──

function buildChildInstruct(
  scopeTable: string,
  extraInstruct?: string,
): string {
  let instruct = `You are a spawned agent. Focus exclusively on the directive.

Parent's current scope:
${scopeTable}

Your final stop() call MUST include: await stop({ scope: <summary>, result: <findings>, keyFiles: [<paths>], issues: [<problems>] })`;

  if (extraInstruct) {
    instruct += `\n\n${extraInstruct}`;
  }

  return instruct;
}

function buildSpawnResult(
  payload: Record<string, unknown> | null,
  context: "empty" | "branch",
  turns: number,
  duration: number,
): SpawnResult {
  if (!payload) {
    // Child completed without a conforming stop — best-effort result
    return {
      scope: "unknown",
      result: null,
      keyFiles: [],
      issues: ["Child agent completed without a structured stop() call"],
      _meta: { context, turns, duration },
    };
  }

  // The stop() function wraps arguments with recovered names.
  // `stop({ scope, result, keyFiles })` becomes { arg_0: { scope, result, keyFiles } }
  // Unwrap a single-argument object that contains the expected structured fields.
  let data = payload;
  const keys = Object.keys(payload);
  if (keys.length === 1) {
    const val = payload[keys[0]];
    if (val && typeof val === "object" && !Array.isArray(val) && ("scope" in val || "result" in val)) {
      data = val as Record<string, unknown>;
    }
  }

  return {
    scope: typeof data.scope === "string" ? data.scope : String(data.scope ?? "unknown"),
    result: data.result ?? null,
    keyFiles: Array.isArray(data.keyFiles) ? data.keyFiles : [],
    issues: Array.isArray(data.issues) ? data.issues : undefined,
    _raw: payload,
    _meta: { context, turns, duration },
  };
}
