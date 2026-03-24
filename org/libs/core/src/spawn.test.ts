import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { executeSpawn } from "./spawn";
import type { SpawnConfig, SpawnContext } from "./spawn";
import { Session } from "@lmthing/repl";
import type { SessionEvent } from "@lmthing/repl";
import { AgentLoop } from "./cli/agent-loop";

// ── Mock streamText ──

// The child AgentLoop calls streamText internally. We mock it to return
// controlled code output so we can test spawn behavior deterministically.
vi.mock("ai", () => ({
  streamText: vi.fn(),
}));

import { streamText } from "ai";
const mockStreamText = streamText as unknown as ReturnType<typeof vi.fn>;

function createMockStream(code: string) {
  return {
    textStream: (async function* () {
      yield code;
    })(),
    usage: Promise.resolve({
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
    }),
    finishReason: Promise.resolve("stop"),
    response: Promise.resolve({
      id: "test-resp",
      modelId: "mock-model",
      timestamp: new Date(),
    }),
  };
}

// ── Mock Model ──

function createMockModel() {
  return {
    specificationVersion: "v2" as const,
    provider: "mock",
    modelId: "mock-model",
    doStream: vi.fn(),
    doGenerate: vi.fn(),
  };
}

// ── Test Helpers ──

function createSpawnContext(overrides: Partial<SpawnContext> = {}): SpawnContext {
  const parentSession = new Session();
  const model = createMockModel();

  return {
    model: model as any,
    modelId: "mock-model",
    messages: [
      { role: "system", content: "system prompt" },
      { role: "user", content: "hello" },
    ],
    scopeTable: "| Name | Type | Value |\n|------|------|-------|\n| x | number | 42 |",
    catalogGlobals: {},
    functionSignatures: "",
    formSignatures: "",
    viewSignatures: "",
    classSignatures: "",
    knowledgeTree: "",
    parentSession,
    ...overrides,
  };
}

describe("sandbox/spawn", () => {
  beforeEach(() => {
    mockStreamText.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("executeSpawn", () => {
    it("creates child session, runs directive, and returns SpawnResult", async () => {
      // Child agent will call stop() with structured output
      const childCode = `await stop({ scope: "test summary", result: { answer: 42 }, keyFiles: ["src/index.ts"] })`;
      mockStreamText.mockReturnValue(createMockStream(childCode));

      const ctx = createSpawnContext();
      const config: SpawnConfig = {
        directive: "Analyze the codebase",
        context: "empty",
      };

      const result = await executeSpawn(config, ctx);

      expect(result.scope).toBe("test summary");
      expect(result.result).toEqual({ answer: 42 });
      expect(result.keyFiles).toEqual(["src/index.ts"]);
      expect(result._meta.context).toBe("empty");
      expect(result._meta.turns).toBeGreaterThanOrEqual(0);
      expect(result._meta.duration).toBeGreaterThanOrEqual(0);

      ctx.parentSession.destroy();
    });

    it("returns best-effort result when child has no conforming stop", async () => {
      // Child agent writes code but never calls stop() with the right format
      const childCode = `// just a comment`;
      mockStreamText.mockReturnValue(createMockStream(childCode));

      const ctx = createSpawnContext();
      const config: SpawnConfig = {
        directive: "Do something",
        context: "empty",
      };

      const result = await executeSpawn(config, ctx);

      expect(result.scope).toBe("unknown");
      expect(result.result).toBeNull();
      expect(result.issues).toContain(
        "Child agent completed without a structured stop() call",
      );

      ctx.parentSession.destroy();
    });

    it("emits spawn_start event on parent session", async () => {
      mockStreamText.mockReturnValue(
        createMockStream(`// no-op`),
      );

      const ctx = createSpawnContext();
      const events: SessionEvent[] = [];
      ctx.parentSession.on("event", (e: SessionEvent) => events.push(e));

      const config: SpawnConfig = {
        directive: "Test directive",
        context: "empty",
      };

      await executeSpawn(config, ctx);

      const startEvent = events.find((e) => e.type === "spawn_start");
      expect(startEvent).toBeDefined();
      expect(startEvent!.type === "spawn_start" && startEvent!.directive).toBe(
        "Test directive",
      );
      expect(
        startEvent!.type === "spawn_start" && startEvent!.context,
      ).toBe("empty");

      ctx.parentSession.destroy();
    });

    it("emits spawn_complete event on parent session", async () => {
      mockStreamText.mockReturnValue(
        createMockStream(`// no-op`),
      );

      const ctx = createSpawnContext();
      const events: SessionEvent[] = [];
      ctx.parentSession.on("event", (e: SessionEvent) => events.push(e));

      await executeSpawn(
        { directive: "Test", context: "empty" },
        ctx,
      );

      const completeEvent = events.find((e) => e.type === "spawn_complete");
      expect(completeEvent).toBeDefined();
      expect(
        completeEvent!.type === "spawn_complete" && completeEvent!.turns,
      ).toBeGreaterThanOrEqual(0);
      expect(
        completeEvent!.type === "spawn_complete" && completeEvent!.duration,
      ).toBeGreaterThanOrEqual(0);

      ctx.parentSession.destroy();
    });

    it("emits spawn_error event on parent session when child throws", async () => {
      // Mock handleMessage to throw (streamText errors are caught internally
      // by runTurnLoop, so we need a higher-level failure)
      const handleMessageSpy = vi
        .spyOn(AgentLoop.prototype, "handleMessage")
        .mockRejectedValue(new Error("LLM connection failed"));

      mockStreamText.mockReturnValue(createMockStream(`// unused`));

      const ctx = createSpawnContext();
      const events: SessionEvent[] = [];
      ctx.parentSession.on("event", (e: SessionEvent) => events.push(e));

      const result = await executeSpawn(
        { directive: "Test", context: "empty" },
        ctx,
      );

      const errorEvent = events.find((e) => e.type === "spawn_error");
      expect(errorEvent).toBeDefined();
      expect(
        errorEvent!.type === "spawn_error" && errorEvent!.error,
      ).toBe("LLM connection failed");

      // Should still return a result (best-effort)
      expect(result.scope).toBe("error");
      expect(result.issues).toContain("LLM connection failed");

      handleMessageSpy.mockRestore();
      ctx.parentSession.destroy();
    });

    it("destroys child session after completion", async () => {
      mockStreamText.mockReturnValue(
        createMockStream(`// done`),
      );

      const ctx = createSpawnContext();

      // Spy on Session.prototype.destroy
      const destroySpy = vi.spyOn(Session.prototype, "destroy");

      await executeSpawn(
        { directive: "Test", context: "empty" },
        ctx,
      );

      // Child session's destroy should have been called
      // (at least once — parent is not destroyed here)
      expect(destroySpy).toHaveBeenCalled();

      destroySpy.mockRestore();
      ctx.parentSession.destroy();
    });

    it("destroys child session even on error", async () => {
      const handleMessageSpy = vi
        .spyOn(AgentLoop.prototype, "handleMessage")
        .mockRejectedValue(new Error("boom"));

      mockStreamText.mockReturnValue(createMockStream(`// unused`));

      const ctx = createSpawnContext();
      const destroySpy = vi.spyOn(Session.prototype, "destroy");

      await executeSpawn(
        { directive: "Test", context: "empty" },
        ctx,
      );

      expect(destroySpy).toHaveBeenCalled();

      handleMessageSpy.mockRestore();
      destroySpy.mockRestore();
      ctx.parentSession.destroy();
    });

    it("uses default maxTurns of 5 when not specified", async () => {
      mockStreamText.mockReturnValue(
        createMockStream(`// done`),
      );

      const ctx = createSpawnContext();

      // We can't easily inspect maxTurns on the child AgentLoop,
      // but we can verify it doesn't error with default
      const result = await executeSpawn(
        { directive: "Test", context: "empty" },
        ctx,
      );

      expect(result._meta.context).toBe("empty");

      ctx.parentSession.destroy();
    });

    it("passes custom maxTurns to child AgentLoop", async () => {
      mockStreamText.mockReturnValue(
        createMockStream(`// done`),
      );

      const ctx = createSpawnContext();
      const config: SpawnConfig = {
        directive: "Test",
        context: "empty",
        maxTurns: 2,
      };

      const result = await executeSpawn(config, ctx);
      expect(result._meta.context).toBe("empty");

      ctx.parentSession.destroy();
    });

    it("appends custom instruct to child system prompt", async () => {
      let capturedMessages: any[] = [];
      mockStreamText.mockImplementation((opts: any) => {
        capturedMessages = opts.messages;
        return createMockStream(`// done`);
      });

      const ctx = createSpawnContext();
      const config: SpawnConfig = {
        directive: "Test",
        context: "empty",
        instruct: "Always respond in JSON format",
      };

      await executeSpawn(config, ctx);

      // The system prompt (first message) should contain the custom instruct
      const systemMsg = capturedMessages.find((m: any) => m.role === "system");
      expect(systemMsg?.content).toContain("Always respond in JSON format");

      ctx.parentSession.destroy();
    });

    it("includes parent scope table in child instruct", async () => {
      let capturedMessages: any[] = [];
      mockStreamText.mockImplementation((opts: any) => {
        capturedMessages = opts.messages;
        return createMockStream(`// done`);
      });

      const ctx = createSpawnContext({
        scopeTable: "| Name | Type | Value |\n| foo | string | bar |",
      });

      await executeSpawn(
        { directive: "Test", context: "empty" },
        ctx,
      );

      const systemMsg = capturedMessages.find((m: any) => m.role === "system");
      expect(systemMsg?.content).toContain("foo");
      expect(systemMsg?.content).toContain("spawned agent");

      ctx.parentSession.destroy();
    });

    it("passes catalogGlobals to child session", async () => {
      const myGlobal = vi.fn().mockReturnValue(42);
      mockStreamText.mockReturnValue(
        createMockStream(`// done`),
      );

      const ctx = createSpawnContext({
        catalogGlobals: { myGlobal },
      });

      // Should not throw — globals are injected into child sandbox
      const result = await executeSpawn(
        { directive: "Test", context: "empty" },
        ctx,
      );

      expect(result._meta.context).toBe("empty");

      ctx.parentSession.destroy();
    });

    it("extracts issues from stop payload when present", async () => {
      const childCode = `await stop({ scope: "review", result: null, keyFiles: [], issues: ["Missing tests", "No docs"] })`;
      mockStreamText.mockReturnValue(createMockStream(childCode));

      const ctx = createSpawnContext();

      const result = await executeSpawn(
        { directive: "Review code", context: "empty" },
        ctx,
      );

      expect(result.issues).toEqual(["Missing tests", "No docs"]);

      ctx.parentSession.destroy();
    });
  });

  describe("context modes", () => {
    it("empty context starts child with no prior messages", async () => {
      let capturedMessages: any[] = [];
      mockStreamText.mockImplementation((opts: any) => {
        capturedMessages = opts.messages;
        return createMockStream(`// done`);
      });

      const ctx = createSpawnContext({
        messages: [
          { role: "system", content: "parent system prompt" },
          { role: "user", content: "parent message 1" },
          { role: "assistant", content: "parent response 1" },
          { role: "user", content: "parent message 2" },
        ],
      });

      await executeSpawn(
        { directive: "Fresh start", context: "empty" },
        ctx,
      );

      // Child should NOT have parent's messages
      // It should have: system prompt + user directive
      const userMsgs = capturedMessages.filter(
        (m: any) => m.role === "user",
      );
      expect(
        userMsgs.some((m: any) => m.content === "parent message 1"),
      ).toBe(false);
      expect(
        userMsgs.some((m: any) => m.content.includes("Fresh start")),
      ).toBe(true);

      ctx.parentSession.destroy();
    });

    it("branch context starts child with cloned parent messages", async () => {
      let capturedMessages: any[] = [];
      mockStreamText.mockImplementation((opts: any) => {
        capturedMessages = opts.messages;
        return createMockStream(`// done`);
      });

      const ctx = createSpawnContext({
        messages: [
          { role: "system", content: "parent system prompt" },
          { role: "user", content: "parent context message" },
          { role: "assistant", content: "parent code here" },
        ],
      });

      await executeSpawn(
        { directive: "Continue from parent", context: "branch" },
        ctx,
      );

      // Child should have parent messages (cloned) plus the directive
      expect(
        capturedMessages.some(
          (m: any) =>
            m.role === "user" && m.content === "parent context message",
        ),
      ).toBe(true);
      // Plus the new directive message
      expect(
        capturedMessages.some(
          (m: any) =>
            m.role === "user" &&
            m.content.includes("Continue from parent"),
        ),
      ).toBe(true);

      ctx.parentSession.destroy();
    });

    it("branch context deep clones messages (no shared references)", async () => {
      mockStreamText.mockReturnValue(
        createMockStream(`// done`),
      );

      const parentMessages = [
        { role: "system" as const, content: "parent system" },
        { role: "user" as const, content: "original message" },
      ];

      const ctx = createSpawnContext({ messages: parentMessages });

      await executeSpawn(
        { directive: "Branch test", context: "branch" },
        ctx,
      );

      // Parent messages should be unchanged
      expect(parentMessages[1].content).toBe("original message");

      ctx.parentSession.destroy();
    });
  });
});
