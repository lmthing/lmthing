import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve, type ServerType } from "@hono/node-server";
import auth from "./routes/auth.js";
import keys from "./routes/keys.js";
import billing from "./routes/billing.js";
import webhook from "./routes/webhook.js";
import compute from "./routes/compute.js";
import backup from "./routes/backup.js";
import inbound from "./routes/inbound.js";
import status from "./routes/status.js";
import issues from "./routes/issues.js";
import teams from "./routes/teams.js";
import push from "./routes/push.js";
import newsletter from "./routes/newsletter.js";
import { podProxy, attachWsProxy } from "./lib/pod-proxy.js";
import { startRefresher } from "./lib/cluster-status.js";
import { ensureSchema } from "./lib/db.js";

const app = new Hono();

// Everything is Bearer-authenticated, so the wildcard is safe: no ambient credential
// rides along with a cross-origin call and there is nothing for another origin to
// abuse. `*` is also what lets a user's own pod (a per-user origin) call the gateway.
const openCors = cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
});

// The one exception. Passwordless sign-in sets a cookie naming the browser that
// asked (see lib/email-login.ts#ORIGIN_COOKIE), and a cookie cannot be stored from a
// cross-site response unless the response says `Allow-Credentials: true` with a
// CONCRETE origin — the spec forbids pairing credentials with `*`. So these routes
// get their own policy that reflects only origins we ship, and everything else keeps
// the wildcard. Reflecting arbitrary origins with credentials is the thing this
// split exists to avoid.
const emailCors = cors({
  origin: (origin) => (isTrustedWebOrigin(origin) ? origin : ""),
  credentials: true,
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
});

/** Origins the SPAs are actually served from — `lmthing.*`, plus the local dev hosts. */
function isTrustedWebOrigin(origin: string): boolean {
  if (!origin) return false;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol === "https:" && /^([a-z0-9-]+\.)*lmthing\.[a-z]{2,}$/.test(host)) return true;
  return (
    host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host.endsWith(".test")
  );
}

const EMAIL_ROUTES = "/api/auth/email/";

app.use("/api/*", (c, next) =>
  c.req.path.startsWith(EMAIL_ROUTES) ? emailCors(c, next) : openCors(c, next),
);

app.get("/api/health", (c) => c.json({ status: "ok" }));

app.route("/api/auth", auth);
app.route("/api/keys", keys);
app.route("/api/billing", billing);
app.route("/api/stripe/webhook", webhook);
app.route("/api/compute", compute);
app.route("/api/backup", backup);
app.route("/api/inbound", inbound);
app.route("/api/status", status);
app.route("/api/issues", issues);
app.route("/api/teams", teams);
app.route("/api/push", push);
app.route("/api/newsletter", newsletter);

// Local dev only: proxy pod API paths (sessions, state, etc.) and WebSocket to the user's minikube pod.
// In production, Envoy Gateway handles this routing via Lua + JWT extraction.
if (process.env.LOCAL_DEV === "true") {
  app.route("/api", podProxy);
}

// Self-heal the gateway's own DB schema before serving traffic. Idempotent;
// logs and continues on failure so a DB blip can't wedge the whole gateway.
await ensureSchema().then(
  () => console.log("DB schema ensured (profiles, sso_codes, backup_config)"),
  (err) => console.error("ensureSchema failed (continuing):", err),
);

const port = parseInt(process.env.PORT || "3000");

console.log(`Gateway listening on port ${port}`);
const server: ServerType = serve({ fetch: app.fetch, port });

if (process.env.LOCAL_DEV === "true") {
  attachWsProxy(server);
}

startRefresher();
// redeploy: gateway PVC + LiteLLM env injection
