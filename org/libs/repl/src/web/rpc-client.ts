import { useState, useEffect, useCallback, useRef, useReducer } from "react";
import type {
  SessionEvent,
  SessionSnapshot,
  SessionStatus,
  SerializedJSX,
  ErrorPayload,
  Tasklist,
} from "../session/types";
import type { ConversationState } from "../session/conversation-state";

// ── Conversation Summary ──

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  turnCount: number;
}

// ── UI Block Model ──

export type UIBlock =
  | { type: "user"; id: string; text: string }
  | { type: "code"; id: string; code: string; streaming: boolean; lineCount: number }
  | { type: "read"; id: string; payload: Record<string, unknown> }
  | { type: "error"; id: string; error: ErrorPayload }
  | { type: "hook"; id: string; hookId: string; action: string; detail: string }
  | { type: "display"; id: string; jsx: SerializedJSX }
  | { type: "form"; id: string; jsx: SerializedJSX; status: "active" | "submitted" | "timeout" }
  | { type: "tasklist_declared"; id: string; tasklistId: string; plan: Tasklist }
  | {
      type: "task_complete";
      id: string;
      tasklistId: string;
      taskId: string;
      output: Record<string, any>;
    };

type BlockAction =
  | { type: "event"; event: SessionEvent }
  | { type: "add_user_message"; id: string; text: string }
  | { type: "reset" };

function blocksReducer(blocks: UIBlock[], action: BlockAction): UIBlock[] {
  if (action.type === "reset") return [];
  if (action.type === "add_user_message") {
    return [...blocks, { type: "user", id: action.id, text: action.text }];
  }

  const event = action.event;
  switch (event.type) {
    case "code": {
      const idx = blocks.findIndex((b) => b.id === event.blockId);
      if (idx >= 0) {
        const block = blocks[idx] as Extract<UIBlock, { type: "code" }>;
        const newCode = block.code + event.lines;
        const newBlocks = [...blocks];
        newBlocks[idx] = { ...block, code: newCode, lineCount: countLines(newCode) };
        return newBlocks;
      }
      return [
        ...blocks,
        {
          type: "code",
          id: event.blockId,
          code: event.lines,
          streaming: true,
          lineCount: countLines(event.lines),
        },
      ];
    }
    case "code_complete": {
      return blocks.map((b) =>
        b.id === event.blockId && b.type === "code" ? { ...b, streaming: false } : b,
      );
    }
    case "read":
      return [...blocks, { type: "read", id: event.blockId, payload: event.payload }];
    case "error":
      return [...blocks, { type: "error", id: event.blockId, error: event.error }];
    case "hook":
      return [
        ...blocks,
        {
          type: "hook",
          id: event.blockId,
          hookId: event.hookId,
          action: event.action,
          detail: event.detail,
        },
      ];
    case "display":
      return [...blocks, { type: "display", id: event.componentId, jsx: event.jsx }];
    case "ask_start":
      return [
        ...blocks,
        { type: "form", id: event.formId, jsx: event.jsx, status: "active" as const },
      ];
    case "ask_end":
      return blocks.map((b) =>
        b.type === "form" && b.id === event.formId ? { ...b, status: "submitted" as const } : b,
      );
    case "tasklist_declared":
      return [
        ...blocks,
        {
          type: "tasklist_declared",
          id: `tl_plan_${event.tasklistId}_${Date.now()}`,
          tasklistId: event.tasklistId,
          plan: event.plan,
        },
      ];
    case "task_complete":
      return [
        ...blocks,
        {
          type: "task_complete",
          id: `tl_${event.tasklistId}_${event.id}`,
          tasklistId: event.tasklistId,
          taskId: event.id,
          output: event.output,
        },
      ];
    default:
      return blocks;
  }
}

function countLines(code: string): number {
  return code.split("\n").filter((l) => l.trim().length > 0).length;
}

// ── Snapshot State ──

function applyEvent(prev: SessionSnapshot, event: SessionEvent): SessionSnapshot {
  switch (event.type) {
    case "status":
      return { ...prev, status: event.status };
    case "scope":
      return { ...prev, scope: event.entries };
    case "async_start":
      return {
        ...prev,
        asyncTasks: [
          ...prev.asyncTasks,
          { id: event.taskId, label: event.label, status: "running", elapsed: 0 },
        ],
      };
    case "async_progress":
      return {
        ...prev,
        asyncTasks: prev.asyncTasks.map((t) =>
          t.id === event.taskId ? { ...t, elapsed: event.elapsed } : t,
        ),
      };
    case "async_complete":
      return {
        ...prev,
        asyncTasks: prev.asyncTasks.map((t) =>
          t.id === event.taskId ? { ...t, status: "completed", elapsed: event.elapsed } : t,
        ),
      };
    case "async_failed":
      return {
        ...prev,
        asyncTasks: prev.asyncTasks.map((t) =>
          t.id === event.taskId ? { ...t, status: "failed" } : t,
        ),
      };
    case "async_cancelled":
      return {
        ...prev,
        asyncTasks: prev.asyncTasks.map((t) =>
          t.id === event.taskId ? { ...t, status: "cancelled" } : t,
        ),
      };
    case "ask_start":
      return { ...prev, activeFormId: event.formId };
    case "ask_end":
      return { ...prev, activeFormId: null };
    default:
      return prev;
  }
}

const EMPTY_SNAPSHOT: SessionSnapshot = {
  status: "idle",
  blocks: [],
  scope: [],
  asyncTasks: [],
  activeFormId: null,
  tasklistsState: { tasklists: new Map() },
  agentEntries: [],
};

// ── Hook ──

export interface AgentAction {
  id: string;
  label: string;
  description: string;
}

export interface UseReplSessionResult {
  /** Current session snapshot (status, scope, async tasks, etc.) */
  snapshot: SessionSnapshot;
  /** Accumulated UI blocks for rendering */
  blocks: UIBlock[];
  /** Whether the WebSocket is connected */
  connected: boolean;
  /** Available slash actions from the agent */
  actions: AgentAction[];
  /** Full serializable conversation state (null until requested) */
  conversationState: ConversationState | null;
  /** List of saved conversations */
  conversations: ConversationSummary[];
  /** Loaded conversation state for history view */
  loadedConversation: { id: string; state: ConversationState } | null;
  /** Send a user message */
  sendMessage: (text: string) => void;
  /** Submit a form */
  submitForm: (formId: string, data: Record<string, unknown>) => void;
  /** Cancel a pending ask */
  cancelAsk: (formId: string) => void;
  /** Cancel a background task */
  cancelTask: (taskId: string, message?: string) => void;
  /** Pause the agent */
  pause: () => void;
  /** Resume the agent */
  resume: () => void;
  /** User intervention — inject a message while agent is running */
  intervene: (text: string) => void;
  /** Request the full conversation state */
  getConversationState: () => void;
  /** Save the current session under a conversation ID */
  saveConversation: (id: string) => void;
  /** Request the list of saved conversations */
  requestConversations: () => void;
  /** Load a saved conversation for viewing */
  loadConversation: (id: string) => void;
}

export function useReplSession(url = "ws://localhost:3010"): UseReplSessionResult {
  const [snapshot, setSnapshot] = useState<SessionSnapshot>(EMPTY_SNAPSHOT);
  const [connected, setConnected] = useState(false);
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [conversationState, setConversationState] = useState<ConversationState | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadedConversation, setLoadedConversation] = useState<{
    id: string;
    state: ConversationState;
  } | null>(null);
  const [blocks, dispatchBlock] = useReducer(blocksReducer, []);
  const wsRef = useRef<WebSocket | null>(null);
  const msgCounterRef = useRef(0);

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: "getSnapshot" }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "snapshot") {
        setSnapshot(data.data);
      } else if (data.type === "actions") {
        setActions(data.data);
      } else if (data.type === "conversationState") {
        setConversationState(data.data);
      } else if (data.type === "conversations") {
        setConversations(data.data);
      } else if (data.type === "conversationLoaded") {
        setLoadedConversation({ id: data.id, state: data.data });
      } else if (data.type === "conversationSaved") {
        // Refresh the list after saving
        ws.send(JSON.stringify({ type: "listConversations" }));
      } else {
        setSnapshot((prev) => applyEvent(prev, data));
        dispatchBlock({ type: "event", event: data });
      }
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    return () => {
      ws.close();
    };
  }, [url]);

  const send = useCallback((msg: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const sendMessage = useCallback(
    (text: string) => {
      const id = `user_${++msgCounterRef.current}`;
      dispatchBlock({ type: "add_user_message", id, text });
      send({ type: "sendMessage", text });
    },
    [send],
  );

  const intervene = useCallback(
    (text: string) => {
      const id = `user_${++msgCounterRef.current}`;
      dispatchBlock({ type: "add_user_message", id, text });
      send({ type: "intervene", text });
    },
    [send],
  );

  const getConversationState = useCallback(() => {
    send({ type: "getConversationState" });
  }, [send]);

  return {
    snapshot,
    blocks,
    connected,
    actions,
    conversationState,
    conversations,
    loadedConversation,
    sendMessage,
    submitForm: (formId, data) => send({ type: "submitForm", formId, data }),
    cancelAsk: (formId) => send({ type: "cancelAsk", formId }),
    cancelTask: (taskId, message) => send({ type: "cancelTask", taskId, message }),
    pause: () => send({ type: "pause" }),
    resume: () => send({ type: "resume" }),
    intervene,
    getConversationState,
    saveConversation: (id: string) => send({ type: "saveConversation", id }),
    requestConversations: () => send({ type: "listConversations" }),
    loadConversation: (id: string) => {
      setLoadedConversation(null);
      send({ type: "loadConversation", id });
    },
  };
}
