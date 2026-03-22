import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import auth from "./routes/auth.js";
import keys from "./routes/keys.js";
import billing from "./routes/billing.js";
import webhook from "./routes/webhook.js";

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

const port = parseInt(process.env.PORT || "3000");

console.log(`Gateway listening on port ${port}`);
serve({ fetch: app.fetch, port });
