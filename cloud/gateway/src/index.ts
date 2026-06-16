import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve, type ServerType } from "@hono/node-server";
import auth from "./routes/auth.js";
import keys from "./routes/keys.js";
import billing from "./routes/billing.js";
import webhook from "./routes/webhook.js";
import compute from "./routes/compute.js";
import { podProxy, attachWsProxy } from "./lib/pod-proxy.js";

const app = new Hono();

app.use(
  "/api/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

app.get("/api/health", (c) => c.json({ status: "ok" }));

app.route("/api/auth", auth);
app.route("/api/keys", keys);
app.route("/api/billing", billing);
app.route("/api/stripe/webhook", webhook);
app.route("/api/compute", compute);

// Local dev only: proxy pod API paths (sessions, state, etc.) and WebSocket to the user's minikube pod.
// In production, Envoy Gateway handles this routing via Lua + JWT extraction.
if (process.env.LOCAL_DEV === "true") {
  app.route("/api", podProxy);
}

const port = parseInt(process.env.PORT || "3000");

console.log(`Gateway listening on port ${port}`);
const server: ServerType = serve({ fetch: app.fetch, port });

if (process.env.LOCAL_DEV === "true") {
  attachWsProxy(server);
}