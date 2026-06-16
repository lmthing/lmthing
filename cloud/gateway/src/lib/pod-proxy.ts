import { Hono } from "hono";
import { connect } from "node:net";
import type { ServerType } from "@hono/node-server";
import type { IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import type { Env } from "../types.js";
import { verifyAccessToken } from "./tokens.js";
import { getPodProxyUrl } from "./compute.js";

const LOCAL_DEV = process.env.LOCAL_DEV === "true";

/** Resolve a token to a userId, accepting the demo placeholder in LOCAL_DEV. */
async function resolveUser(
  token: string,
): Promise<{ userId: string } | null> {
  if (LOCAL_DEV && token === "demo") return { userId: "local-dev-user" };
  return verifyAccessToken(token);
}

// Paths served by the compute pod (not by the gateway itself).
// All of these are proxied to the user's pod when LOCAL_DEV=true.
const POD_PATH_PREFIXES = [
  "/api/sessions",
  "/api/state",
  "/api/events",
  "/api/asks",
  "/api/message",
  "/api/help",
  "/api/node",
];

export const podProxy = new Hono<Env>();

podProxy.all("*", async (c) => {
  const path = new URL(c.req.url).pathname;
  if (!POD_PATH_PREFIXES.some((p) => path.startsWith(p))) {
    return c.notFound();
  }

  const token =
    c.req.query("access_token") ??
    c.req.header("Authorization")?.slice(7) ??
    null;
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  const user = await resolveUser(token);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const podUrl = await getPodProxyUrl(user.userId);
  if (!podUrl) return c.json({ error: "Pod not ready" }, 503);

  const url = new URL(c.req.url);
  const target = `${podUrl}${url.pathname}${url.search}`;

  const hasBody = !["GET", "HEAD"].includes(c.req.method);
  const res = await fetch(target, {
    method: c.req.method,
    headers: c.req.raw.headers,
    body: hasBody ? c.req.raw.body : undefined,
    // Node fetch requires duplex:'half' when the body is a ReadableStream
    ...(hasBody ? { duplex: "half" } : {}),
  } as RequestInit);

  return new Response(res.body, {
    status: res.status,
    headers: res.headers,
  });
});

/**
 * Attach a WebSocket upgrade proxy to the Node.js HTTP server.
 * Handles `wss://computer.test/api/ws?access_token=<JWT>` locally.
 * Validates the JWT, resolves the pod's NodePort, and pipes raw TCP sockets.
 */
export function attachWsProxy(server: ServerType) {
  server.on(
    "upgrade",
    async (req: IncomingMessage, socket: Socket, head: Buffer) => {
      const rawUrl = req.url ?? "/";
      const url = new URL(rawUrl, "http://localhost");

      // Only proxy WebSocket connections destined for the compute pod
      if (!url.pathname.startsWith("/api/ws")) return;

      const token = url.searchParams.get("access_token");
      if (!token) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      const user = await resolveUser(token);
      if (!user) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      const podUrl = await getPodProxyUrl(user.userId);
      if (!podUrl) {
        socket.write("HTTP/1.1 503 Service Unavailable\r\n\r\n");
        socket.destroy();
        return;
      }

      const target = new URL(podUrl);
      const podPort = parseInt(target.port, 10);
      const podHost = target.hostname;

      const proxy = connect(podPort, podHost, () => {
        // Forward the original upgrade request to the pod
        const headers = Object.entries(req.headers)
          .filter(([k]) => k !== "host")
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
          .join("\r\n");

        proxy.write(
          `GET ${url.pathname}${url.search} HTTP/1.1\r\n` +
            `Host: ${podHost}:${podPort}\r\n` +
            `${headers}\r\n` +
            `\r\n`,
        );

        if (head?.length) proxy.write(head);
        socket.pipe(proxy).pipe(socket);
      });

      socket.on("error", () => proxy.destroy());
      proxy.on("error", () => {
        socket.write("HTTP/1.1 502 Bad Gateway\r\n\r\n");
        socket.destroy();
      });
    },
  );
}
