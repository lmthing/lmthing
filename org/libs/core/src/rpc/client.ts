import type { ReplSession } from "./interface";

/**
 * Connect to a REPL session server.
 * In production, this uses capnweb for WebSocket RPC.
 * This is a placeholder that will be replaced with the actual implementation.
 */
export function connectToRepl(url = "ws://localhost:3010"): ReplSession {
  // Placeholder — actual implementation will use capnweb:
  // return newWebSocketRpcSession<ReplSession>(url)
  throw new Error(
    `connectToRepl requires capnweb. Use ReplSessionServer directly for testing. URL: ${url}`,
  );
}
