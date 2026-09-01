import { readFileSync } from "node:fs";
import { getTierByName, TIERS, type PodConfig } from "./tiers.js";
import * as litellm from "./litellm.js";
import { signComputeToken } from "./tokens.js";
import { deleteCronJobs } from "./db.js";

// Local dev: when K8S_LOCAL_PROXY=true, talk to minikube via `kubectl proxy --port=8001`
// (no TLS, no service account token needed).
// Production: use in-cluster service account auto-mounted by K8s.
const LOCAL_DEV = process.env.LOCAL_DEV === "true";
const LOCAL_PROXY = process.env.K8S_LOCAL_PROXY === "true";

const K8S_API =
  process.env.K8S_API_URL ??
  (process.env.KUBERNETES_SERVICE_HOST
    ? `https://${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_SERVICE_PORT}`
    : "https://kubernetes.default.svc");

const TOKEN_PATH = "/var/run/secrets/kubernetes.io/serviceaccount/token";

function getAuthHeaders(): Record<string, string> {
  if (LOCAL_PROXY) return {};
  return { Authorization: `Bearer ${readFileSync(TOKEN_PATH, "utf-8").trim()}` };
}

export async function k8s(
  path: string,
  method: string,
  body?: unknown,
  contentType = "application/json",
) {
  const res = await fetch(`${K8S_API}${path}`, {
    method,
    headers: {
      ...getAuthHeaders(),
      "Content-Type": contentType,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 404) return null;
  if (res.status === 409) return "conflict"; // already exists

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`K8s ${method} ${path}: ${res.status} — ${text}`);
  }

  return res.json();
}

// ACR credentials injected from lmthing-secrets (not used when LOCAL_DEV=true)
const ACR_REGISTRY = process.env.ACR_REGISTRY ?? "lmthingacr.azurecr.io";
const ACR_USERNAME = process.env.ACR_USERNAME ?? "";
const ACR_PASSWORD = process.env.ACR_PASSWORD ?? "";
// The latest compute image tag, updated by CI on every new compute build.
// Empty string means "unknown" — no upgrade banner is shown in that case.
export const COMPUTE_IMAGE_TAG = process.env.COMPUTE_IMAGE_TAG ?? "";
// Digest-pin (P4): when CI sets COMPUTE_IMAGE_DIGEST (bare `sha256:...`), free
// pods run the immutable-by-digest image with imagePullPolicy: IfNotPresent, so a
// cold start reuses layers the pre-pull DaemonSet already cached on the node (the
// #1 cold-start killer is re-pulling the moving `:latest` tag on every wake). When
// UNSET, behaviour is unchanged: `:latest` + Always. Local dev is untouched.
const COMPUTE_IMAGE_DIGEST = process.env.COMPUTE_IMAGE_DIGEST ?? "";
const COMPUTE_IMAGE = LOCAL_DEV
  ? (process.env.COMPUTE_IMAGE ?? "compute:local")
  : COMPUTE_IMAGE_DIGEST
    ? `${ACR_REGISTRY}/compute@${COMPUTE_IMAGE_DIGEST}`
    : `${ACR_REGISTRY}/compute:latest`;
// Digest is immutable ⇒ IfNotPresent (cached layers are always the right ones).
// A moving `:latest` tag ⇒ Always (re-pull so a new build is picked up on recreate).
const COMPUTE_IMAGE_PULL_POLICY =
  !LOCAL_DEV && COMPUTE_IMAGE_DIGEST ? "IfNotPresent" : "Always";
// Dedicated user-pod node pool (P4): set COMPUTE_NODE_POOL=user in the gateway
// env ONCE the tainted pool node exists. Unset ⇒ no nodeSelector/toleration, so
// pods schedule anywhere (today's single-node behaviour) — this keeps deploys
// safe before the pool is provisioned.
const COMPUTE_NODE_POOL = process.env.COMPUTE_NODE_POOL ?? "";
// Backstop idle-sweep staleness threshold: a pod whose `last-active` annotation
// is older than this (missed heartbeats ⇒ wedged self-idle watchdog) is scaled to
// zero by the gateway even though it didn't self-report. Generous so it never
// races a genuinely-active pod (which heartbeats every ≤5 min).
const SWEEP_STALE_MS =
  (Number(process.env.COMPUTE_SWEEP_STALE_MIN) || 30) * 60_000;
const LAST_ACTIVE_ANNOTATION = "lmthing.cloud/last-active";
// Refuse a self-idle scale-down within this window of the last wake/heartbeat —
// guards the (rare) wake → immediate-idle race.
const WAKE_RACE_MS = 30_000;
// Max time `ensureUserPod` waits for a freshly-woken pod to report ready before
// returning. Kept well under the ingress timeout (~15s) so /ensure never 504s.
const WAKE_READY_WAIT_MS = Number(process.env.COMPUTE_WAKE_READY_WAIT_MS) || 9_000;
const PULL_SECRET_NAME = "acr-pull-secret";

/** Parse a K8s memory quantity ("512Mi", "1Gi", "768Mi") to MiB. */
function memToMiB(mem: string): number {
  const m = /^(\d+(?:\.\d+)?)\s*(Mi|Gi|M|G)?$/.exec(mem.trim());
  if (!m) return 512;
  const n = Number(m[1]);
  switch (m[2]) {
    case "Gi": return Math.round(n * 1024);
    case "G": return Math.round((n * 1_000_000_000) / (1024 * 1024));
    case "M": return Math.round((n * 1_000_000) / (1024 * 1024));
    default: return Math.round(n); // Mi (or bare)
  }
}

/**
 * How a pod's memory LIMIT is divided between the three things that consume it.
 *
 * This used to be one line — V8 gets 60% of the limit — with a comment noting that QuickJS WASM
 * VMs live off-heap and are therefore NOT bounded by it, and that "the in-pod watchdog bounds the
 * rest". Both halves of that were true and the sum was still fatal: nothing ever added the parts
 * up against the ceiling.
 *
 * On the free tier the arithmetic was
 *
 *     307 (V8 may grow to this)  +  64 (one QuickJS VM)  +  ~60 (Node baseline)  =  431 of 512
 *
 * — 84% consumed with ONE sandbox. A single `delegate()` makes a second (97%), and
 * `maxConcurrentForks` permits four (623, i.e. over the limit before anything has gone wrong).
 * A free pod was OOMKilled mid-turn on an ordinary research question: the user's budget was spent,
 * the container died, the session died with it and the reply never arrived
 * (.issues/session-lost-when-pod-recycles.md).
 *
 * The watchdog cannot cover this and it is worth saying why, because its existence is what made the
 * gap look handled: it polls every 5s while a VM allocates its arena in milliseconds, and its only
 * remedy is evicting an IDLE session — during a single turn on a fresh session there is nothing
 * idle to evict.
 *
 * So the budget is now derived, and {@link memoryBudget} is the only place that decides. Every
 * consumer of a number here — the V8 cap, the per-VM arena, the fork fan-out — is handed a value
 * from the same division, and `compute.budget.test.ts` asserts the parts fit inside the limit for
 * every tier.
 */

/** Node's own RSS before any agent work: the interpreter, the loaded bundle, sockets, buffers. */
const NODE_BASELINE_MIB = 128;

/**
 * Fraction of the LIMIT the budget is allowed to plan for. The remainder absorbs what no
 * accounting can predict — allocator fragmentation, a GC that has not run yet, native module
 * overhead — and is the difference between running hot and being killed.
 */
const PLANNING_HEADROOM = 0.85;

/** A QuickJS arena small enough that a free pod can afford two, large enough for real work. */
const VM_MIB_SMALL = 48;
const VM_MIB_LARGE = 64;

export interface MemoryBudget {
  /** `--max-old-space-size`, i.e. what V8's old space may grow to. */
  v8MiB: number;
  /** Per-QuickJS-VM arena, off-heap. Passed to the pod so it stops taking a hardcoded default. */
  vmMiB: number;
  /** How many sandboxes may exist at once. The multiplier on `vmMiB`. */
  maxConcurrentForks: number;
}

export function memoryBudget(pod: PodConfig): MemoryBudget {
  const limitMiB = memToMiB(pod.mem);
  const plannable = Math.floor(limitMiB * PLANNING_HEADROOM) - NODE_BASELINE_MIB;

  // Small pods buy fewer and smaller sandboxes rather than a smaller heap: a V8 cap under ~128MiB
  // makes the host itself thrash, and a host that cannot run is worse than one that delegates less.
  const vmMiB = limitMiB >= 1024 ? VM_MIB_LARGE : VM_MIB_SMALL;
  const maxConcurrentForks = limitMiB >= 1024 ? 4 : 2;

  const v8MiB = Math.max(128, plannable - vmMiB * maxConcurrentForks);
  return { v8MiB, vmMiB, maxConcurrentForks };
}

/** V8 old-space cap — see {@link memoryBudget} for why it is not simply a fraction of the limit. */
function nodeOptionsFor(pod: PodConfig): string {
  return `--max-old-space-size=${memoryBudget(pod).v8MiB}`;
}

/**
 * The sandbox half of the budget, as pod env. Without these the runtime falls back to its own
 * defaults (a 64MiB arena and 4 concurrent forks) which is exactly the drift this exists to stop —
 * the gateway would be sizing V8 against numbers the pod did not agree to.
 */
function sandboxEnvFor(pod: PodConfig): Array<{ name: string; value: string }> {
  const { vmMiB, maxConcurrentForks } = memoryBudget(pod);
  return [
    { name: "LM_VM_MEMORY_MB", value: String(vmMiB) },
    { name: "LM_MAX_CONCURRENT_FORKS", value: String(maxConcurrentForks) },
  ];
}

/** nodeSelector + tolerations for the user pool, or `{}` when the pool is not
 *  enabled (COMPUTE_NODE_POOL unset). Spread into a Pod spec. */
function poolPlacement(): Record<string, unknown> {
  if (!COMPUTE_NODE_POOL) return {};
  return {
    nodeSelector: { "lmthing.cloud/pool": COMPUTE_NODE_POOL },
    tolerations: [
      {
        key: "lmthing.cloud/pool",
        operator: "Equal",
        value: COMPUTE_NODE_POOL,
        effect: "NoSchedule",
      },
    ],
  };
}

// --- Pod principals ---
//
// A compute pod belongs to a *principal*: either a user or a team. The two are
// provisioned identically — same Deployment, Service, PVC and env secret — and
// differ only in which namespace they live in and which LiteLLM/billing identity
// pays for them.
//
// `principalKey` is the string a principal is known by OUTSIDE Kubernetes: its
// LiteLLM user id, the `user_id` column in the gateway's own tables, and the
// subject of the scoped tokens the pod calls back with. A user's key is their
// bare id, so every pre-existing row, key alias and token keeps working
// unchanged; a team's key is `team-<id>`, which is also its namespace.

export type PodPrincipal = { kind: "user" | "team"; id: string };

export const userPrincipal = (id: string): PodPrincipal => ({ kind: "user", id });
export const teamPrincipal = (id: string): PodPrincipal => ({ kind: "team", id });

/** The principal's Kubernetes namespace: `user-<id>` or `team-<id>`. */
export const nsOf = (p: PodPrincipal): string => `${p.kind}-${p.id}`;

/** The principal's identity outside K8s (LiteLLM user, DB key, token subject). */
export const principalKey = (p: PodPrincipal): string =>
  p.kind === "user" ? p.id : `team-${p.id}`;

/** Inverse of {@link principalKey}, for values read back out of the DB or a token. */
export const parsePrincipalKey = (key: string): PodPrincipal =>
  key.startsWith("team-") ? teamPrincipal(key.slice("team-".length)) : userPrincipal(key);

// --- Pod template (inline — matches k8s/compute/user-pod-template.yaml) ---

/** Identifying labels every resource in a principal's namespace carries. */
function principalLabels(p: PodPrincipal): Record<string, string> {
  return {
    "lmthing.cloud/principal": principalKey(p),
    // Retained for user pods so pre-existing selectors and tooling keep matching.
    ...(p.kind === "user" ? { "lmthing.cloud/user": p.id } : {}),
  };
}

function namespace(p: PodPrincipal) {
  return {
    apiVersion: "v1",
    kind: "Namespace",
    metadata: {
      name: nsOf(p),
      labels: {
        ...principalLabels(p),
        "lmthing.cloud/type": "compute",
      },
    },
  };
}

function acrPullSecret(p: PodPrincipal) {
  const auth = Buffer.from(`${ACR_USERNAME}:${ACR_PASSWORD}`).toString(
    "base64",
  );
  const dockerConfig = Buffer.from(
    JSON.stringify({ auths: { [ACR_REGISTRY]: { auth } } }),
  ).toString("base64");
  return {
    apiVersion: "v1",
    kind: "Secret",
    metadata: { name: PULL_SECRET_NAME, namespace: nsOf(p) },
    type: "kubernetes.io/dockerconfigjson",
    data: { ".dockerconfigjson": dockerConfig },
  };
}

function dataPvc(p: PodPrincipal) {
  return {
    apiVersion: "v1",
    kind: "PersistentVolumeClaim",
    metadata: {
      name: "user-data",
      namespace: nsOf(p),
      labels: principalLabels(p),
    },
    spec: {
      accessModes: ["ReadWriteOnce"],
      resources: { requests: { storage: "1Gi" } },
      // uses the cluster default StorageClass
    },
  };
}

/**
 * What a TEAM pod gets that a user pod does not.
 *
 * `LMTHING_TEAM_MODE=1` turns on caller identity and viewer/editor gating — a
 * user pod stays the single-tenant server it has always been.
 *
 * `LMTHING_TEAM_ID` so the pod can name itself in the notifications it asks for
 * (a deep link needs the team in the path, and the pod only ever learns its team
 * from request headers otherwise).
 *
 * `LMTHING_PUSH_SECRET` authorizes `POST /api/push/send`. All three are CONTAINER
 * env vars, deliberately not keys in the editable `user-env` secret: an editor
 * can rewrite that one wholesale with `PUT /api/compute/env`, and a pod able to
 * grant itself the ability to notify arbitrary users — or to turn its own guard
 * off — would be a real escalation.
 *
 * The secret is omitted when the gateway has none, so an unprovisioned
 * environment simply has no push rather than a pod holding an empty credential.
 */
function teamModeEnv(p: PodPrincipal): Array<{ name: string; value: string }> {
  if (p.kind !== "team") return [];
  const pushSecret = process.env.POD_PUSH_SECRET;
  return [
    { name: "LMTHING_TEAM_MODE", value: "1" },
    { name: "LMTHING_TEAM_ID", value: p.id },
    ...(pushSecret ? [{ name: "LMTHING_PUSH_SECRET", value: pushSecret }] : []),
  ];
}

const DEFAULT_POD_CONFIG: PodConfig = {
  cpu: "500m",
  mem: "1Gi",
  idleTtlMinutes: 30,
  maxSessions: 3,
};

function deployment(p: PodPrincipal, pod: PodConfig = DEFAULT_POD_CONFIG) {
  return {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      name: "lmthing",
      namespace: nsOf(p),
      // Baseline for the idle-sweep backstop. Refreshed on wake + by pod
      // heartbeats (annotateLastActive); on Deployment METADATA, never the pod
      // template (a template patch would trigger a rolling restart).
      annotations: { [LAST_ACTIVE_ANNOTATION]: new Date().toISOString() },
    },
    spec: {
      replicas: 1,
      selector: { matchLabels: { app: "compute" } },
      template: {
        metadata: {
          labels: {
            app: "compute",
            ...principalLabels(p),
          },
          ...(COMPUTE_IMAGE_TAG
            ? { annotations: { "lmthing.cloud/compute-tag": COMPUTE_IMAGE_TAG } }
            : {}),
        },
        spec: {
          ...(LOCAL_DEV ? {} : { imagePullSecrets: [{ name: PULL_SECRET_NAME }] }),
          // Pin free pods to the tainted user pool when enabled (P4); no-op today.
          ...poolPlacement(),
          // Grace window so the SIGTERM backup flush (≤25s cap) finishes before
          // SIGKILL on scale-to-zero. Default 30s is too tight.
          terminationGracePeriodSeconds: 45,
          containers: [
            {
              name: "compute",
              image: COMPUTE_IMAGE,
              imagePullPolicy: COMPUTE_IMAGE_PULL_POLICY,
              ports: [{ containerPort: 8080 }],
              resources: {
                // Burstable when *Request < limit (free tier): the scheduler packs
                // by requests, the limit caps a busy pod. Falls back to limit when
                // *Request is omitted (paid tiers stay Guaranteed).
                requests: {
                  memory: pod.memRequest ?? pod.mem,
                  cpu: pod.cpuRequest ?? pod.cpu,
                },
                limits: { memory: pod.mem, cpu: pod.cpu },
              },
              env: [
                { name: "MAX_SESSIONS", value: String(pod.maxSessions) },
                { name: "IDLE_TTL_MINUTES", value: String(pod.idleTtlMinutes) },
                // Bound the V8 heap under the Burstable limit (GC before OOM).
                { name: "NODE_OPTIONS", value: nodeOptionsFor(pod) },
                ...sandboxEnvFor(pod),
                // Turns on the pod's caller-identity + role guard. Deliberately a
                // CONTAINER env var, not a `user-env` key: PUT /env is replace-all,
                // so a team editor could otherwise drop this key and silently
                // disable the guard. Container env also wins over envFrom, so a
                // value set in the secret can't override it either.
                ...teamModeEnv(p),
              ],
              envFrom: [{ secretRef: { name: "user-env", optional: true } }],
              volumeMounts: [{ name: "data", mountPath: "/data" }],
              // STARTUP probe (not readiness): gate ONLY the boot window so Envoy
              // doesn't route to a still-booting pod on wake. Once it first
              // succeeds it never runs again — critical because this is a
              // single-threaded Node server: a readinessProbe would keep probing
              // and, whenever the event loop is busy (a QuickJS agent turn or an
              // esbuild page build blocks it > timeoutSeconds), FAIL and yank the
              // pod out of the Service endpoints mid-session → Envoy "connection
              // refused" 503s under the pod's own load. A startup probe can't do
              // that. Generous timeout/threshold so a slow cold boot isn't failed.
              //
              // The target must answer an ANONYMOUS caller: the kubelet probes
              // from inside the cluster, not through Envoy, so it carries no
              // identity headers. A team pod gates every other route on those
              // headers, so probing anything else 401s and the pod crash-loops.
              startupProbe: {
                httpGet: { path: "/api/health", port: 8080 },
                initialDelaySeconds: 0, // probe immediately — a warm-cached image
                // + burst CPU can listen sub-second; don't make the probe the floor.
                periodSeconds: 1, // poll every 1s so a booted pod is routable ~1s sooner
                timeoutSeconds: 5,
                failureThreshold: 120, // up to ~120s to boot before giving up
              },
            },
          ],
          volumes: [
            {
              name: "data",
              persistentVolumeClaim: { claimName: "user-data" },
            },
          ],
        },
      },
    },
  };
}

function service(p: PodPrincipal) {
  return {
    apiVersion: "v1",
    kind: "Service",
    metadata: {
      name: "lmthing",
      namespace: nsOf(p),
    },
    spec: {
      // NodePort when LOCAL_DEV so the gateway process (running on the host) can reach the pod
      type: LOCAL_DEV ? "NodePort" : "ClusterIP",
      selector: { app: "compute" },
      ports: [{ port: 8080, targetPort: 8080 }],
    },
  };
}

function envSecret(p: PodPrincipal, vars: Record<string, string>) {
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) {
    data[k] = Buffer.from(v).toString("base64");
  }
  return {
    apiVersion: "v1",
    kind: "Secret",
    metadata: { name: "user-env", namespace: nsOf(p) },
    type: "Opaque",
    data,
  };
}

// --- LiteLLM key helpers ---

/**
 * Returns the principal's LiteLLM virtual key string (sk-...). For a team this is
 * the team's own key, carrying the team's budget — nothing a team spends is ever
 * billed against a member's key.
 */
async function getLiteLLMKey(p: PodPrincipal): Promise<string> {
  const { TIERS } = await import("./tiers.js");
  const key = principalKey(p);
  // Ensure the LiteLLM user exists (idempotent — ignore "already exists").
  try {
    await litellm.createUser(key, TIERS.free);
  } catch {
    // already provisioned
  }
  // LiteLLM requires globally-unique key aliases, so scope it per principal
  // (the default "default" alias collides across users).
  try {
    const result = await litellm.generateKey(key, TIERS.free, `compute-${key}`);
    return result.key as string;
  } catch (err) {
    // Alias already provisioned by a previous ensure/upgrade call. LiteLLM
    // never returns a key's raw secret again after creation (/key/list only
    // returns hashed tokens), so recover the value already persisted in the
    // pod's env instead of erroring out on every subsequent call.
    const existing = await getEnvVars(p);
    if (existing.LMTHINGCLOUD_API_KEY) return existing.LMTHINGCLOUD_API_KEY;
    throw err;
  }
}

/**
 * The env vars a fresh pod needs to reach lmthing.cloud as an LLM provider.
 * `litellmKey` is the user's own LiteLLM virtual key — the one tied to their
 * subscription, carrying the tier's 1d/7d/30d budget windows. The size/role
 * model aliases resolve through @lmthing/cli's `lmthingcloud:` provider, which
 * reads LMTHINGCLOUD_API_KEY + LMTHINGCLOUD_BASE_URL.
 */
// The size/role + vision/transcribe model aliases. Gateway-owned and STATIC
// (independent of the user's LiteLLM key), so declared apart from
// litellmEnvDefaults: the /ensure hot path can detect a stale alias from these
// WITHOUT a LiteLLM round-trip, and force-overwriting them (injectLiteLLMEnv)
// propagates a changed default to EXISTING pods instead of freezing it out.
// A user wanting a different model keeps the escape hatch of bare LM_MODEL or
// --model — neither lives here, so neither is clobbered.
const MODEL_ALIAS_DEFAULTS = {
  LM_MODEL_XS: "lmthingcloud:DeepSeek-V4-Flash-0731",
  LM_MODEL_S: "lmthingcloud:DeepSeek-V4-Flash-0731",
  LM_MODEL_M: "lmthingcloud:DeepSeek-V4-Flash-0731",
  // Every alias is Flash. Pro was measured hanging mid-turn at 0% CPU on 2 of 3 lanes (38k and ~23k
  // log lines) and never returning — unbounded latency, not slow latency — while Flash completed
  // every lane in 9-16 min. LM_MODEL_VISION is deliberately NOT Flash: it is not vision-capable, and
  // the system-vision agent THING delegates images to would break.
  LM_MODEL_L: "lmthingcloud:DeepSeek-V4-Flash-0731",
  LM_MODEL_M_R: "lmthingcloud:DeepSeek-V4-Flash-0731",
  LM_MODEL_L_R: "lmthingcloud:DeepSeek-V4-Flash-0731",
  // Vision model for the system-vision space agent (image analysis). Cheap,
  // vision-capable; THING (a text model) delegates images to it.
  LM_MODEL_VISION: "lmthingcloud:gpt-5.4-mini",
  // Audio transcription (chat vision/audio feature) routed through LiteLLM so
  // Azure creds stay off the pod and usage bills against the user's own key.
  // `whisper-1` is registered in devops/argocd/core/litellm.yaml → azure/whisper.
  LM_TRANSCRIBE_MODEL: "lmthingcloud:whisper-1",
} as const satisfies Record<string, string>;

function litellmEnvDefaults(litellmKey: string): Record<string, string> {
  return {
    LMTHINGCLOUD_API_KEY: litellmKey,
    // In-cluster LiteLLM endpoint — keeps model traffic off the public ingress.
    LMTHINGCLOUD_BASE_URL: "http://litellm.lmthing.svc.cluster.local:4000/v1",
    // In-cluster gateway — the pod's /api/budget forwards here (the gateway
    // computes budgets with the master key, which an over-budget user key can't).
    LMTHING_GATEWAY_URL: "http://gateway.lmthing.svc.cluster.local:3000",
    // In-cluster headless-browser render service — the system-global webSearch bing
    // provider POSTs Bing's results URL here to get JS-rendered HTML. ClusterIP-only,
    // token-gated (RENDER_SERVICE_TOKEN below); reachable only from compute pods.
    RENDER_SERVICE_URL: "http://render.lmthing.svc.cluster.local:3000",
    RENDER_SERVICE_TOKEN: process.env.RENDER_SERVICE_TOKEN ?? "",
    ...MODEL_ALIAS_DEFAULTS,
  };
}

/**
 * Merges LiteLLM env into the user-env secret. User-only keys (anything not in
 * litellmEnvDefaults) are preserved; gateway-owned keys are authoritative — the
 * subscription key, the in-cluster endpoints, AND the model aliases — so a
 * changed default model propagates to EXISTING pods instead of being frozen at
 * the old value by the merge. Only writes (and thus rolls the pod, via
 * setEnvVars) when something actually changed. /ensure calls this only when
 * creds are incomplete OR a model alias is stale (the modelStale gate), so a
 * steady-state wake no-ops.
 */
export async function injectLiteLLMEnv(
  p: PodPrincipal,
  litellmKey: string,
): Promise<void> {
  const existing = await getEnvVars(p);
  const defaults = litellmEnvDefaults(litellmKey);
  const merged: Record<string, string> = { ...defaults, ...existing };
  // The user's subscription key is authoritative — never let a stale value win.
  merged.LMTHINGCLOUD_API_KEY = litellmKey;
  // The in-cluster render service URL/token are cluster-owned — always authoritative so a
  // stale or user-set value can't misroute or break the webSearch google provider.
  merged.RENDER_SERVICE_URL = defaults.RENDER_SERVICE_URL!;
  merged.RENDER_SERVICE_TOKEN = defaults.RENDER_SERVICE_TOKEN!;
  // The model aliases are gateway-owned defaults too, so force them — otherwise a
  // change to MODEL_ALIAS_DEFAULTS (e.g. a new default M model) would be frozen out
  // by the spread above on every pod that already carries the old value.
  for (const [k, v] of Object.entries(MODEL_ALIAS_DEFAULTS)) {
    merged[k] = v;
  }
  // Only update if something actually changed
  const needsUpdate = Object.keys(defaults).some(
    (k) => existing[k] !== merged[k],
  );
  if (needsUpdate) {
    await setEnvVars(p, merged);
  }
}

/**
 * Ensure the pod→gateway compute credentials are present in user-env: a scoped
 * compute JWT (self-idle + cron-manifest auth) and the self-idle enable flag.
 * GET-merge-PUT so LiteLLM/user keys are never clobbered; writes only when a value
 * is missing (the JWT is long-lived — no rotation on every ensure, so no needless
 * pod restart). This is the migration path for pods created before P1.
 */
async function injectComputeEnv(p: PodPrincipal): Promise<void> {
  const existing = await getEnvVars(p);
  const additions: Record<string, string> = {};
  if (!existing.LMTHING_COMPUTE_JWT) {
    // Subject is the principal key, so a team pod's callbacks (self-idle, cron
    // and webhook manifests) land under `team-<id>` in the gateway's tables.
    additions.LMTHING_COMPUTE_JWT = await signComputeToken(principalKey(p));
  }
  if (existing.LMTHING_SELF_IDLE === undefined) {
    additions.LMTHING_SELF_IDLE = "1";
  }
  if (Object.keys(additions).length === 0) return;
  await setEnvVars(p, { ...existing, ...additions });
}

/**
 * Refresh the Deployment's `last-active` annotation — the idle-sweep backstop
 * clock. Stamped on wake and by pod activity heartbeats. Patches the Deployment
 * METADATA (a merge-patch), never the pod template, so it never rolls the pod.
 */
export async function annotateLastActive(
  p: PodPrincipal,
  iso: string = new Date().toISOString(),
): Promise<void> {
  const ns = nsOf(p);
  await k8s(
    `/apis/apps/v1/namespaces/${ns}/deployments/lmthing`,
    "PATCH",
    { metadata: { annotations: { [LAST_ACTIVE_ANNOTATION]: iso } } },
    "application/merge-patch+json",
  );
}

/** Resolve a principal's tier pod sizing (defaults to free). Used by the cron-wake
 *  tick so a woken pod gets its own tier's resources, not a generic default.
 *  Takes the principal KEY, since callers usually have it from a token or a DB row. */
export async function resolvePodConfig(principalKeyOrUserId: string): Promise<PodConfig> {
  try {
    const info = await litellm.getUserInfo(principalKeyOrUserId);
    const tierName = info.user_info?.metadata?.tier || "free";
    return (getTierByName(tierName) ?? TIERS.free).pod;
  } catch {
    return TIERS.free.pod;
  }
}

/** Read the epoch-ms of a pod's `last-active` annotation, or null if unset. */
async function getLastActive(p: PodPrincipal): Promise<number | null> {
  const ns = nsOf(p);
  const dep = (await k8s(
    `/apis/apps/v1/namespaces/${ns}/deployments/lmthing`,
    "GET",
  )) as { metadata?: { annotations?: Record<string, string> } } | null;
  const iso = dep?.metadata?.annotations?.[LAST_ACTIVE_ANNOTATION];
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Handle a pod's activity report (pod → gateway, POST /api/compute/self-idle).
 *   - `idle: false` → heartbeat: refresh the sweep backstop clock.
 *   - `idle: true`  → self-report idle: scale the pod to 0, UNLESS a wake/heartbeat
 *     was stamped within {@link WAKE_RACE_MS} (guards the wake → immediate-idle race).
 * The userId comes from the verified compute token, so a pod can only ever act on
 * its own namespace. Returns what happened (for logging).
 */
export async function reportPodActivity(
  p: PodPrincipal,
  idle: boolean,
): Promise<"scaled-down" | "heartbeat" | "wake-race"> {
  if (!idle) {
    await annotateLastActive(p);
    return "heartbeat";
  }
  const last = await getLastActive(p);
  if (last !== null && Date.now() - last < WAKE_RACE_MS) return "wake-race";
  await scalePod(p, 0);
  console.log(`[self-idle] scaled down pod for ${nsOf(p)} (self-reported idle)`);
  return "scaled-down";
}

// --- Public API ---

export async function getEnvVars(
  p: PodPrincipal,
): Promise<Record<string, string>> {
  const ns = nsOf(p);
  const secret = await k8s(`/api/v1/namespaces/${ns}/secrets/user-env`, "GET");
  if (!secret || !secret.data) return {};
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(
    secret.data as Record<string, string>,
  )) {
    vars[k] = Buffer.from(v, "base64").toString("utf-8");
  }
  return vars;
}

export async function setEnvVars(
  p: PodPrincipal,
  vars: Record<string, string>,
): Promise<void> {
  const ns = nsOf(p);
  const existing = await k8s(
    `/api/v1/namespaces/${ns}/secrets/user-env`,
    "GET",
  );
  if (existing) {
    await k8s(
      `/api/v1/namespaces/${ns}/secrets/user-env`,
      "PUT",
      envSecret(p, vars),
    );
  } else {
    await k8s(
      `/api/v1/namespaces/${ns}/secrets`,
      "POST",
      envSecret(p, vars),
    );
  }
  // Trigger rolling restart so pods pick up the new env vars
  await k8s(
    `/apis/apps/v1/namespaces/${ns}/deployments/lmthing`,
    "PATCH",
    {
      spec: {
        template: {
          metadata: {
            annotations: {
              "kubectl.kubernetes.io/restartedAt": new Date().toISOString(),
            },
          },
        },
      },
    },
    "application/merge-patch+json",
  );
}

export async function createPod(
  p: PodPrincipal,
  pod: PodConfig = DEFAULT_POD_CONFIG,
): Promise<void> {
  const ns = nsOf(p);

  // Create namespace (skip if exists)
  const nsResult = await k8s("/api/v1/namespaces", "POST", namespace(p));
  if (nsResult === "conflict") {
    console.log(`Namespace ${ns} already exists, skipping creation`);
  } else {
    console.log(`Created namespace ${ns}`);
  }

  // Create ACR pull secret (skip in local dev — compute:local is loaded directly into minikube)
  if (!LOCAL_DEV) {
    const pullSecretResult = await k8s(
      `/api/v1/namespaces/${ns}/secrets`,
      "POST",
      acrPullSecret(p),
    );
    if (pullSecretResult === "conflict") {
      console.log(`ACR pull secret in ${ns} already exists, skipping`);
    } else {
      console.log(`Created ACR pull secret in ${ns}`);
    }
  }

  // Create PVC for /data persistence (skip if exists)
  const pvcResult = await k8s(
    `/api/v1/namespaces/${ns}/persistentvolumeclaims`,
    "POST",
    dataPvc(p),
  );
  if (pvcResult === "conflict") {
    console.log(`PVC in ${ns} already exists, skipping`);
  } else {
    console.log(`Created PVC in ${ns}`);
  }

  // Fetch the principal's LiteLLM virtual key and build the initial env secret
  let litellmKey = "";
  try {
    litellmKey = await getLiteLLMKey(p);
  } catch (err) {
    console.warn(`Could not fetch LiteLLM key for ${ns}: ${err}`);
  }
  // Seed the initial env with LiteLLM defaults + the pod→gateway compute creds
  // (scoped JWT + self-idle flag) so a fresh pod boots ready to self-report and
  // publish its cron manifest — no post-create restart needed.
  const computeJwt = await signComputeToken(principalKey(p));
  const initialEnv: Record<string, string> = {
    ...(litellmKey ? litellmEnvDefaults(litellmKey) : {}),
    LMTHING_COMPUTE_JWT: computeJwt,
    LMTHING_SELF_IDLE: "1",
  };

  // Create env secret with LiteLLM defaults (skip if exists — will be merged below)
  const envResult = await k8s(
    `/api/v1/namespaces/${ns}/secrets`,
    "POST",
    envSecret(p, initialEnv),
  );
  if (envResult === "conflict") {
    console.log(`Env secret in ${ns} already exists, merging LiteLLM + compute keys`);
    // Secret already exists — merge defaults without clobbering user-set keys
    if (litellmKey) {
      await injectLiteLLMEnv(p, litellmKey);
    }
    await injectComputeEnv(p);
  } else {
    console.log(`Created env secret in ${ns}`);
  }

  // Create deployment (skip if exists)
  const depResult = await k8s(
    `/apis/apps/v1/namespaces/${ns}/deployments`,
    "POST",
    deployment(p, pod),
  );
  if (depResult === "conflict") {
    console.log(`Deployment in ${ns} already exists, skipping`);
  } else {
    console.log(`Created deployment in ${ns}`);
  }

  // Create service (skip if exists)
  const svcResult = await k8s(
    `/api/v1/namespaces/${ns}/services`,
    "POST",
    service(p),
  );
  if (svcResult === "conflict") {
    console.log(`Service in ${ns} already exists, skipping`);
  } else {
    console.log(`Created service in ${ns}`);
  }
}

/**
 * Scale a principal's compute deployment to the given replica count.
 * Typically called with replicas=0 (idle teardown) or replicas=1 (wake up).
 *
 * The PRIMARY scale-down path is the pod self-reporting idle (POST
 * /api/compute/self-idle → reportPodActivity); {@link sweepIdlePods} is the
 * gateway-side backstop for pods whose watchdog stopped heartbeating.
 */
export async function scalePod(
  p: PodPrincipal,
  replicas: number,
): Promise<void> {
  const ns = nsOf(p);
  await k8s(
    `/apis/apps/v1/namespaces/${ns}/deployments/lmthing/scale`,
    "PATCH",
    { spec: { replicas } },
    "application/merge-patch+json",
  );
  console.log(`Scaled deployment in ${ns} to ${replicas} replica(s)`);
}

/**
 * Idempotent: bring the principal's pod to a running state with the correct tier
 * sizing.
 *
 * - If the namespace/deployment does not exist: create everything (via createPod).
 * - If the deployment exists but is scaled to 0: scale it to 1 and patch resources.
 * - If the deployment exists and is already running: patch resources to match the
 *   new tier (handles upgrades/downgrades) and no-op the replica count.
 *
 * Returns connection info the frontend needs to open a session.
 */
export async function ensurePod(
  p: PodPrincipal,
  pod: PodConfig,
): Promise<{ host: string; port: number }> {
  const ns = nsOf(p);

  const dep = await k8s(
    `/apis/apps/v1/namespaces/${ns}/deployments/lmthing`,
    "GET",
  );

  if (!dep) {
    // First use — provision the full namespace + resources
    await createPod(p, pod);
  } else {
    // Patch resources + env + pod-shape to match current config (handles tier
    // changes AND migrates existing pods onto the P1–P4 spec — Burstable requests,
    // NODE_OPTIONS, readiness probe, grace, pool placement, digest image — on the
    // next wake). A strategic-merge patch that changes nothing is a no-op (no roll).
    await k8s(
      `/apis/apps/v1/namespaces/${ns}/deployments/lmthing`,
      "PATCH",
      {
        spec: {
          template: {
            spec: {
              ...poolPlacement(),
              terminationGracePeriodSeconds: 45,
              containers: [
                {
                  name: "compute",
                  image: COMPUTE_IMAGE,
                  imagePullPolicy: COMPUTE_IMAGE_PULL_POLICY,
                  resources: {
                    requests: {
                      memory: pod.memRequest ?? pod.mem,
                      cpu: pod.cpuRequest ?? pod.cpu,
                    },
                    limits: { memory: pod.mem, cpu: pod.cpu },
                  },
                  env: [
                    { name: "MAX_SESSIONS", value: String(pod.maxSessions) },
                    {
                      name: "IDLE_TTL_MINUTES",
                      value: String(pod.idleTtlMinutes),
                    },
                    { name: "NODE_OPTIONS", value: nodeOptionsFor(pod) },
                    ...sandboxEnvFor(pod),
                    ...teamModeEnv(p),
                  ],
                  // Migrate existing pods to the startup probe and REMOVE the old
                  // readiness probe (readinessProbe: null deletes it in a
                  // strategic-merge patch) — a readiness probe yanks a busy
                  // single-threaded pod out of the Service under its own load.
                  readinessProbe: null,
                  startupProbe: {
                    httpGet: { path: "/api/health", port: 8080 },
                    initialDelaySeconds: 0,
                    periodSeconds: 1,
                    timeoutSeconds: 5,
                    failureThreshold: 120,
                  },
                },
              ],
            },
          },
        },
      },
      "application/strategic-merge-patch+json",
    );

    // Scale FIRST so the kubelet starts pulling/creating the pod in parallel with
    // the (idempotent, non-rolling) env work below — the env injectors don't roll
    // a running pod on steady state, and a freshly-scaled pod reads its env from
    // the user-env secret (envFrom) at container start, seeded by a prior ensure.
    const currentReplicas = dep.spec?.replicas ?? 0;
    if (currentReplicas === 0) {
      await scalePod(p, 1);
      console.log(`Woke up scaled-to-zero pod for ${ns}`);
    }

    // Ensure LiteLLM + compute env are present (idempotent merges). On a steady-
    // state wake all creds already live in user-env from a prior ensure, so skip
    // the LiteLLM round-trips + extra k8s GETs entirely — they no-op but cost real
    // gateway↔LiteLLM latency on the blocking /ensure the SPA awaits. The one
    // exception is a stale MODEL alias: a changed default must reach EXISTING pods,
    // so a stale alias also buys the LiteLLM round-trip (one-time, per default
    // change) and force-overwrites via injectLiteLLMEnv.
    let envComplete = false;
    let modelStale = false;
    try {
      const env = await getEnvVars(p);
      envComplete = Boolean(
        env.LMTHINGCLOUD_API_KEY && env.LMTHING_COMPUTE_JWT && env.LMTHING_SELF_IDLE,
      );
      modelStale = Object.entries(MODEL_ALIAS_DEFAULTS).some(
        ([k, v]) => env[k] !== v,
      );
    } catch {
      /* couldn't read env — fall through to the full (idempotent) inject path */
    }
    if (!envComplete || modelStale) {
      try {
        const litellmKey = await getLiteLLMKey(p);
        await injectLiteLLMEnv(p, litellmKey);
      } catch (err) {
        console.warn(`Could not inject LiteLLM env for ${ns}: ${err}`);
      }
      if (!envComplete) {
        try {
          await injectComputeEnv(p);
        } catch (err) {
          console.warn(`Could not inject compute env for ${ns}: ${err}`);
        }
      }
    }
  }

  // Stamp the idle-sweep backstop clock — an ensure means the principal is active.
  try {
    await annotateLastActive(p);
  } catch (err) {
    console.warn(`Could not annotate last-active for ${ns}: ${err}`);
  }

  // Bounded wait for the pod to actually be serving before returning, so the
  // caller (SPA) connects to a ready pod instead of racing the cold-boot window
  // (Envoy has no ready endpoint until the startup probe passes → "connection
  // refused" 503s). Warm pods return on the first check (~no delay). Capped well
  // under the ~15s ingress timeout; a slower boot just returns not-ready and the
  // client polls /status.
  await waitForPodReady(p, WAKE_READY_WAIT_MS);

  if (LOCAL_DEV) {
    // Resolve the NodePort assigned to the user's service so the gateway proxy can reach it
    const svc = await k8s(`/api/v1/namespaces/${ns}/services/lmthing`, "GET");
    const nodePort = svc?.spec?.ports?.[0]?.nodePort as number | undefined;
    const minikubeIp = process.env.MINIKUBE_IP ?? "192.168.49.2";
    return { host: minikubeIp, port: nodePort ?? 8080 };
  }

  // In-cluster DNS for the user's service
  return {
    host: `lmthing.${ns}.svc.cluster.local`,
    port: 8080,
  };
}

/**
 * Fast wake — used by the Envoy activator (`POST /api/compute/wake`), which fires
 * on ANY request that hits a scaled-to-zero pod (Envoy has no Service endpoint →
 * 503). Unlike `ensureUserPod` this SKIPS the bounded readiness wait and the
 * LiteLLM env re-injection: it must return immediately because the original
 * caller is already going to retry into the waking pod. A scaled-to-zero pod
 * already carries its correct shape/env from the last `ensurePod`, so a plain
 * `scalePod(1)` is enough; only a never-provisioned principal needs the full
 * `createPod`. Idempotent + cheap, so every retry in the wake window is safe.
 */
export async function wakePod(p: PodPrincipal, pod: PodConfig): Promise<void> {
  const ns = nsOf(p);
  const dep = await k8s(
    `/apis/apps/v1/namespaces/${ns}/deployments/lmthing`,
    "GET",
  );
  if (!dep) {
    await createPod(p, pod);
  } else if ((dep.spec?.replicas ?? 0) === 0) {
    await scalePod(p, 1);
    console.log(`[activator] woke scaled-to-zero pod for ${ns}`);
  }
  // Stamp the idle-sweep backstop clock — a wake means the principal is active.
  try {
    await annotateLastActive(p);
  } catch (err) {
    console.warn(`Could not annotate last-active for ${ns}: ${err}`);
  }
}

// Short cache of "pod is serving" so the lmthing.app wake-wait (B1) — which Envoy
// may call on every document navigation — costs ~0 k8s reads / LiteLLM round-trips
// on a warm pod. TTL is deliberately short so a pod that scaled to zero in between
// is re-checked promptly.
const READY_CACHE_TTL_MS = 5_000;
const readyCache = new Map<string, number>(); // namespace → epoch-ms last seen ready

/**
 * Wake the user's pod and BLOCK until it's serving (bounded by `timeoutMs`).
 * Returns true if the pod became ready. Backs `POST /api/compute/wake-wait`, which
 * lets a lmthing.app document navigation hold at the edge and render the real page
 * directly instead of bouncing through the reload-loop waking screen. A warm pod
 * short-circuits via the ready cache — no wake, no k8s poll, no tier lookup — so
 * repeated doc navs stay cheap. Tier/pod config is resolved lazily only on a miss.
 */
export async function wakeAndWaitPod(
  p: PodPrincipal,
  timeoutMs: number,
): Promise<boolean> {
  const ns = nsOf(p);
  const cached = readyCache.get(ns);
  if (cached && Date.now() - cached < READY_CACHE_TTL_MS) return true;
  const pod = await resolvePodConfig(principalKey(p));
  await wakePod(p, pod);
  const ready = await waitForPodReady(p, timeoutMs);
  if (ready) readyCache.set(ns, Date.now());
  else readyCache.delete(ns);
  return ready;
}

/**
 * Returns the URL to reach a user's compute server from the host (LOCAL_DEV only).
 *
 * Two modes:
 *   COMPUTE_LOCAL_URL set → single shared server running on the host (e.g. bun --watch).
 *     All users share one instance. No minikube pod needed.
 *   Otherwise → per-user pod in minikube, accessed via NodePort.
 *
 * Returns null in production (pods are only reachable in-cluster via Envoy).
 */
export async function getPodProxyUrl(p: PodPrincipal): Promise<string | null> {
  if (!LOCAL_DEV) return null;
  if (process.env.COMPUTE_LOCAL_URL) return process.env.COMPUTE_LOCAL_URL;
  const ns = nsOf(p);
  const svc = await k8s(`/api/v1/namespaces/${ns}/services/lmthing`, "GET");
  const nodePort = svc?.spec?.ports?.[0]?.nodePort as number | undefined;
  if (!nodePort) return null;
  const minikubeIp = process.env.MINIKUBE_IP ?? "192.168.49.2";
  return `http://${minikubeIp}:${nodePort}`;
}

/**
 * Base URL the GATEWAY itself uses to reach a user's pod (as opposed to
 * {@link getPodProxyUrl}, which is for a browser/host process in LOCAL_DEV).
 * Used by the inbound-webhook broker to forward a request into the pod.
 * In production, the gateway runs in-cluster, so it dials the same DNS name
 * `ensurePod` hands back as `host` — `lmthing.<namespace>.svc.cluster.local`
 * on port 8080. In LOCAL_DEV the gateway runs on the host, so it reuses
 * `getPodProxyUrl`'s NodePort resolution.
 */
export async function getPodInternalBaseUrl(
  p: PodPrincipal,
): Promise<string | null> {
  if (LOCAL_DEV) return getPodProxyUrl(p);
  return `http://lmthing.${nsOf(p)}.svc.cluster.local:8080`;
}

/**
 * Backstop idle-sweep controller body. Enumerates every compute namespace's
 * Deployment and scales to 0 any pod that is (a) currently at replicas ≥ 1 and
 * (b) whose `last-active` annotation is older than {@link SWEEP_STALE_MS} — i.e.
 * its self-idle watchdog stopped heartbeating (wedged / crashed / pre-migration
 * old image). The PRIMARY scale-down path is the pod self-reporting idle (POST
 * /api/compute/self-idle); this only catches pods that failed to.
 *
 * A pod with NO annotation gets one grace round: we stamp it now and skip, so a
 * genuinely-active pod is never scaled down the instant this ships. Best-effort
 * per namespace — one failure never aborts the sweep. Runs behind `withLeaderLock`
 * (cluster-status.ts) so only one of the 2 gateway replicas sweeps each tick.
 */
export async function sweepIdlePods(): Promise<{
  scanned: number;
  scaledDown: number;
}> {
  // Select by the label every gateway-created namespace carries rather than by
  // name prefix, so team namespaces are swept too and the set can never drift
  // from what createPod actually makes.
  const nsData = (await k8s(
    `/api/v1/namespaces?labelSelector=${encodeURIComponent("lmthing.cloud/type=compute")}`,
    "GET",
  )) as {
    items?: Array<{ metadata?: { name?: string } }>;
  } | null;
  const computeNs = (nsData?.items ?? [])
    .map((n) => n.metadata?.name ?? "")
    .filter(Boolean);

  const now = Date.now();
  let scaledDown = 0;
  await Promise.allSettled(
    computeNs.map(async (ns) => {
      const principal = principalFromNamespace(ns);
      if (!principal) return;
      const dep = (await k8s(
        `/apis/apps/v1/namespaces/${ns}/deployments/lmthing`,
        "GET",
      )) as {
        spec?: { replicas?: number };
        metadata?: { annotations?: Record<string, string> };
      } | null;
      if (!dep) return;
      if ((dep.spec?.replicas ?? 0) < 1) return; // already scaled to zero

      const lastActive = dep.metadata?.annotations?.[LAST_ACTIVE_ANNOTATION];
      if (!lastActive) {
        // No baseline yet (pre-migration pod) — grace round: stamp and wait.
        await annotateLastActive(principal, new Date(now).toISOString()).catch(() => {});
        return;
      }
      const lastMs = Date.parse(lastActive);
      if (Number.isFinite(lastMs) && now - lastMs < SWEEP_STALE_MS) return; // fresh

      await scalePod(principal, 0);
      scaledDown++;
      console.log(
        `[sweep] scaled down stale pod ${ns} (last-active ${lastActive})`,
      );
    }),
  );
  if (scaledDown > 0 || computeNs.length > 0) {
    console.log(`[sweep] scanned ${computeNs.length} pod(s), scaled down ${scaledDown}`);
  }
  return { scanned: computeNs.length, scaledDown };
}

/** Recover the principal a compute namespace belongs to, or null if it is neither shape. */
function principalFromNamespace(ns: string): PodPrincipal | null {
  if (ns.startsWith("user-")) return userPrincipal(ns.slice("user-".length));
  if (ns.startsWith("team-")) return teamPrincipal(ns.slice("team-".length));
  return null;
}

export async function deletePod(p: PodPrincipal): Promise<void> {
  const ns = nsOf(p);

  // Delete the namespace — cascades to all resources within it
  const result = await k8s(`/api/v1/namespaces/${ns}`, "DELETE");
  if (result === null) {
    console.log(`Namespace ${ns} not found, nothing to delete`);
  } else {
    console.log(`Deleted namespace ${ns}`);
  }
  // Drop the principal's externalized cron schedule so the wake tick stops
  // targeting a now-deleted pod.
  await deleteCronJobs(principalKey(p)).catch((err) =>
    console.warn(`Could not delete cron jobs for ${ns}: ${err}`),
  );
}

/**
 * Fine-grained cold-boot milestones, ordered. Derived from the pod's K8s
 * conditions + container state so the wake screen can show *real* progress
 * (not a cosmetic loop). K8s doesn't expose image-pull byte progress, so this
 * is a monotonic sequence of observable milestones, not a smooth percentage.
 */
export type PodStage =
  | "absent" // no deployment at all
  | "scheduling" // pod not yet placed on a node
  | "pulling" // pulling the compute image (the long pole on a cold node)
  | "starting" // image local, container created/initializing
  | "probing" // container process running, startup/readiness probe not green yet
  | "ready"; // serving

// Weighted progress per milestone (0..1). Image pull dominates cold-boot
// wall-clock, so it carries the widest span.
const STAGE_PROGRESS: Record<PodStage, number> = {
  absent: 0,
  scheduling: 0.08,
  pulling: 0.4,
  starting: 0.75,
  probing: 0.9,
  ready: 1,
};

export interface PodStatus {
  exists: boolean;
  ready: boolean;
  phase: string | null;
  /** Fine-grained boot milestone (drives the wake screen's progress bar). */
  stage?: PodStage;
  /** Weighted boot progress 0..1 — monotonic, milestone-based (not byte-level). */
  progress?: number;
  /** The compute image tag that was set when the pod was last created or upgraded. */
  computeTag?: string;
}

interface K8sPodCondition {
  type: string;
  status: string;
}
interface K8sContainerStatus {
  ready?: boolean;
  state?: {
    waiting?: { reason?: string };
    running?: { startedAt?: string };
    terminated?: unknown;
  };
}
interface K8sPod {
  metadata?: { creationTimestamp?: string; deletionTimestamp?: string };
  status?: {
    conditions?: K8sPodCondition[];
    containerStatuses?: K8sContainerStatus[];
  };
}

/**
 * Inspect the user's compute pod and classify how far its cold boot has gotten.
 * Reads pod conditions + the container's `state.waiting.reason`. Returns
 * "scheduling" if no pod exists yet (deployment just scaled up). Throws only on
 * an unexpected K8s error — callers fall back to the coarse deployment phase.
 */
async function readPodMilestone(ns: string): Promise<PodStage> {
  const list = await k8s(
    `/api/v1/namespaces/${ns}/pods?labelSelector=${encodeURIComponent("app=compute")}`,
    "GET",
  );
  const items: K8sPod[] = list?.items ?? [];
  if (items.length === 0) return "scheduling";

  // During a rolling upgrade an old pod lingers with a deletionTimestamp; the
  // wake progress we care about is the newest, non-terminating replica.
  const live = items.filter((p) => !p.metadata?.deletionTimestamp);
  const pool = live.length ? live : items;
  pool.sort((a, b) =>
    (b.metadata?.creationTimestamp ?? "").localeCompare(
      a.metadata?.creationTimestamp ?? "",
    ),
  );
  const pod = pool[0];

  const conds = pod.status?.conditions ?? [];
  const cond = (t: string) => conds.find((c) => c.type === t)?.status === "True";
  const cs = pod.status?.containerStatuses?.[0];

  if (cond("Ready")) return "ready";
  if (!cond("PodScheduled")) return "scheduling";

  const waiting = cs?.state?.waiting?.reason;
  if (waiting && /ImagePull|ErrImage|ContainerCreating/.test(waiting)) {
    return "pulling";
  }
  // Scheduled, image local; container not yet executing its process.
  if (!cs?.state?.running) return "starting";
  // Process is up but the startup/readiness probe hasn't gone green.
  return "probing";
}

export async function getPodStatus(p: PodPrincipal): Promise<PodStatus> {
  const ns = nsOf(p);

  const dep = await k8s(
    `/apis/apps/v1/namespaces/${ns}/deployments/lmthing`,
    "GET",
  );

  if (!dep) {
    return { exists: false, ready: false, phase: null, stage: "absent", progress: 0 };
  }

  const readyReplicas = dep.status?.readyReplicas ?? 0;
  const computeTag: string | undefined =
    dep.spec?.template?.metadata?.annotations?.["lmthing.cloud/compute-tag"];

  // Fully up — no need to inspect the pod; the aggregate is authoritative.
  if (readyReplicas > 0) {
    return {
      exists: true,
      ready: true,
      phase: "running",
      stage: "ready",
      progress: 1,
      ...(computeTag ? { computeTag } : {}),
    };
  }

  // Not ready yet — derive a fine-grained milestone from the pod for progress UI.
  let stage: PodStage = dep.status?.conditions?.find(
    (c: { type: string }) => c.type === "Progressing",
  )
    ? "starting"
    : "scheduling";
  try {
    stage = await readPodMilestone(ns);
  } catch {
    /* pod read failed — keep the coarse deployment-derived stage above */
  }

  // Readiness stays tied to the deployment aggregate (the Service endpoint the
  // SPA connects to only populates then), so never report 100% until it flips.
  const progress =
    stage === "ready" ? 0.95 : STAGE_PROGRESS[stage];

  return {
    exists: true,
    ready: false,
    phase: readyReplicas > 0 ? "running" : stage === "scheduling" ? "pending" : "starting",
    stage,
    progress,
    ...(computeTag ? { computeTag } : {}),
  };
}

/**
 * Bounded poll for a pod to report ready, capped at `timeoutMs`. Extracted out
 * of `ensureUserPod` so other short-lived callers that need a "wake, then wait
 * a modest bit" flow — e.g. the inbound-webhook broker (routes/inbound.ts),
 * which must still return to the caller quickly — can reuse the exact same
 * poll instead of duplicating it. No-ops (returns true immediately) in
 * LOCAL_DEV, matching `ensureUserPod`'s prior behaviour.
 */
export async function waitForPodReady(
  p: PodPrincipal,
  timeoutMs: number,
): Promise<boolean> {
  if (LOCAL_DEV) return true;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const st = await getPodStatus(p);
      if (st.ready) return true;
    } catch {
      /* transient — keep polling */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

/**
 * Trigger a rolling restart of the principal's compute pod, updating the
 * compute-tag annotation so the new image version is tracked.
 * Since imagePullPolicy is Always and the image uses :latest, the new pod
 * will pull the latest compute image from ACR.
 */
export async function restartPod(p: PodPrincipal): Promise<void> {
  const ns = nsOf(p);
  await k8s(
    `/apis/apps/v1/namespaces/${ns}/deployments/lmthing`,
    "PATCH",
    {
      spec: {
        template: {
          metadata: {
            annotations: {
              "kubectl.kubernetes.io/restartedAt": new Date().toISOString(),
              ...(COMPUTE_IMAGE_TAG
                ? { "lmthing.cloud/compute-tag": COMPUTE_IMAGE_TAG }
                : {}),
            },
          },
        },
      },
    },
    "application/merge-patch+json",
  );
  console.log(`Triggered rolling restart for ${ns} pod`);
}
