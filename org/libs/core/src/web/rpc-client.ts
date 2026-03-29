import { useState, useEffect, useCallback, useRef, useReducer } from "react";
import type {
  SessionEvent,
  SessionSnapshot,
  ConversationState,
} from "@lmthing/repl";

// Re-export types and blocksReducer from the shared UI library
export type { UIBlock, BlockAction, ConversationSummary, AgentAction } from "@lmthing/ui/components/thing/thing-web-view/types";
export { blocksReducer } from "@lmthing/ui/components/thing/thing-web-view/blocks";

import type { UIBlock, AgentAction, ConversationSummary } from "@lmthing/ui/components/thing/thing-web-view/types";
import { blocksReducer } from "@lmthing/ui/components/thing/thing-web-view/blocks";

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

export interface UseReplSessionResult {
  snapshot: SessionSnapshot;
  blocks: UIBlock[];
  connected: boolean;
  actions: AgentAction[];
  conversationState: ConversationState | null;
  conversations: ConversationSummary[];
  loadedConversation: { id: string; state: ConversationState } | null;
  sendMessage: (text: string) => void;
  submitForm: (formId: string, data: Record<string, unknown>) => void;
  cancelAsk: (formId: string) => void;
  cancelTask: (taskId: string, message?: string) => void;
  pause: () => void;
  resume: () => void;
  intervene: (text: string) => void;
  getConversationState: () => void;
  saveConversation: (id: string) => void;
  requestConversations: () => void;
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
