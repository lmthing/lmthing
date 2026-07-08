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

/** V8 old-space cap (~60% of the memory LIMIT) so the JS heap GCs before the
 *  cgroup OOMs. QuickJS WASM VMs live in off-heap ArrayBuffers, so this bounds the
 *  host-heap portion; the in-pod watchdog bounds the rest. */
function nodeOptionsFor(pod: PodConfig): string {
  const capMiB = Math.max(128, Math.floor(memToMiB(pod.mem) * 0.6));
  return `--max-old-space-size=${capMiB}`;
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

// --- Pod template (inline — matches k8s/compute/user-pod-template.yaml) ---

function namespace(userId: string) {
  return {
    apiVersion: "v1",
    kind: "Namespace",
    metadata: {
      name: `user-${userId}`,
      labels: {
        "lmthing.cloud/user": userId,
        "lmthing.cloud/type": "compute",
      },
    },
  };
}

function acrPullSecret(userId: string) {
  const auth = Buffer.from(`${ACR_USERNAME}:${ACR_PASSWORD}`).toString(
    "base64",
  );
  const dockerConfig = Buffer.from(
    JSON.stringify({ auths: { [ACR_REGISTRY]: { auth } } }),
  ).toString("base64");
  return {
    apiVersion: "v1",
    kind: "Secret",
    metadata: { name: PULL_SECRET_NAME, namespace: `user-${userId}` },
    type: "kubernetes.io/dockerconfigjson",
    data: { ".dockerconfigjson": dockerConfig },
  };
}

function dataPvc(userId: string) {
  return {
    apiVersion: "v1",
    kind: "PersistentVolumeClaim",
    metadata: {
      name: "user-data",
      namespace: `user-${userId}`,
      labels: { "lmthing.cloud/user": userId },
    },
    spec: {
      accessModes: ["ReadWriteOnce"],
      resources: { requests: { storage: "1Gi" } },
      // uses the cluster default StorageClass
    },
  };
}

const DEFAULT_POD_CONFIG: PodConfig = {
  cpu: "500m",
  mem: "1Gi",
  idleTtlMinutes: 30,
  maxSessions: 3,
};

function deployment(userId: string, pod: PodConfig = DEFAULT_POD_CONFIG) {
  return {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      name: "lmthing",
      namespace: `user-${userId}`,
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
            "lmthing.cloud/user": userId,
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
              startupProbe: {
                httpGet: { path: "/api/sessions", port: 8080 },
                initialDelaySeconds: 1,
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

function service(userId: string) {
  return {
    apiVersion: "v1",
    kind: "Service",
    metadata: {
      name: "lmthing",
      namespace: `user-${userId}`,
    },
    spec: {
      // NodePort when LOCAL_DEV so the gateway process (running on the host) can reach the pod
      type: LOCAL_DEV ? "NodePort" : "ClusterIP",
      selector: { app: "compute" },
      ports: [{ port: 8080, targetPort: 8080 }],
    },
  };
}

function envSecret(userId: string, vars: Record<string, string>) {
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) {
    data[k] = Buffer.from(v).toString("base64");
  }
  return {
    apiVersion: "v1",
    kind: "Secret",
    metadata: { name: "user-env", namespace: `user-${userId}` },
    type: "Opaque",
    data,
  };
}

// --- LiteLLM key helpers ---

/**
 * Returns the user's LiteLLM virtual key string (sk-...).
 * Fetches the first existing key via listKeys; if none exist, generates one.
 */
async function getLiteLLMKey(userId: string): Promise<string> {
  const { TIERS } = await import("./tiers.js");
  // Ensure the LiteLLM user exists (idempotent — ignore "already exists").
  try {
    await litellm.createUser(userId, TIERS.free);
  } catch {
    // already provisioned
  }
  // LiteLLM requires globally-unique key aliases, so scope it per user
  // (the default "default" alias collides across users).
  try {
    const result = await litellm.generateKey(userId, TIERS.free, `compute-${userId}`);
    return result.key as string;
  } catch (err) {
    // Alias already provisioned by a previous ensure/upgrade call. LiteLLM
    // never returns a key's raw secret again after creation (/key/list only
    // returns hashed tokens), so recover the value already persisted in the
    // pod's env instead of erroring out on every subsequent call.
    const existing = await getEnvVars(userId);
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
function litellmEnvDefaults(litellmKey: string): Record<string, string> {
  return {
    LMTHINGCLOUD_API_KEY: litellmKey,
    // In-cluster LiteLLM endpoint — keeps model traffic off the public ingress.
    LMTHINGCLOUD_BASE_URL: "http://litellm.lmthing.svc.cluster.local:4000/v1",
    // In-cluster gateway — the pod's /api/budget forwards here (the gateway
    // computes budgets with the master key, which an over-budget user key can't).
    LMTHING_GATEWAY_URL: "http://gateway.lmthing.svc.cluster.local:3000",
    LM_MODEL_XS: "lmthingcloud:DeepSeek-V4-Flash",
    LM_MODEL_S: "lmthingcloud:DeepSeek-V4-Flash",
    LM_MODEL_M: "lmthingcloud:DeepSeek-V4-Pro",
    LM_MODEL_L: "lmthingcloud:gpt-5.5",
    LM_MODEL_M_R: "lmthingcloud:DeepSeek-V4-Pro",
    LM_MODEL_L_R: "lmthingcloud:Kimi-K2.6",
  };
}

/**
 * Merges LiteLLM model env vars into the user-env secret without clobbering
 * keys the user set themselves. Only writes defaults for keys that are absent —
 * except LMTHINGCLOUD_API_KEY, which always tracks the user's current key.
 */
async function injectLiteLLMEnv(
  userId: string,
  litellmKey: string,
): Promise<void> {
  const existing = await getEnvVars(userId);
  const defaults = litellmEnvDefaults(litellmKey);
  const merged: Record<string, string> = { ...defaults, ...existing };
  // The user's subscription key is authoritative — never let a stale value win.
  merged.LMTHINGCLOUD_API_KEY = litellmKey;
  // Only update if something actually changed
  const needsUpdate = Object.keys(defaults).some(
    (k) => existing[k] !== merged[k],
  );
  if (needsUpdate) {
    await setEnvVars(userId, merged);
  }
}

/**
 * Ensure the pod→gateway compute credentials are present in user-env: a scoped
 * compute JWT (self-idle + cron-manifest auth) and the self-idle enable flag.
 * GET-merge-PUT so LiteLLM/user keys are never clobbered; writes only when a value
 * is missing (the JWT is long-lived — no rotation on every ensure, so no needless
 * pod restart). This is the migration path for pods created before P1.
 */
async function injectComputeEnv(userId: string): Promise<void> {
  const existing = await getEnvVars(userId);
  const additions: Record<string, string> = {};
  if (!existing.LMTHING_COMPUTE_JWT) {
    additions.LMTHING_COMPUTE_JWT = await signComputeToken(userId);
  }
  if (existing.LMTHING_SELF_IDLE === undefined) {
    additions.LMTHING_SELF_IDLE = "1";
  }
  if (Object.keys(additions).length === 0) return;
  await setEnvVars(userId, { ...existing, ...additions });
}

/**
 * Refresh the Deployment's `last-active` annotation — the idle-sweep backstop
 * clock. Stamped on wake and by pod activity heartbeats. Patches the Deployment
 * METADATA (a merge-patch), never the pod template, so it never rolls the pod.
 */
export async function annotateLastActive(
  userId: string,
  iso: string = new Date().toISOString(),
): Promise<void> {
  const ns = `user-${userId}`;
  await k8s(
    `/apis/apps/v1/namespaces/${ns}/deployments/lmthing`,
    "PATCH",
    { metadata: { annotations: { [LAST_ACTIVE_ANNOTATION]: iso } } },
    "application/merge-patch+json",
  );
}

/** Resolve a user's tier pod sizing (defaults to free). Used by the cron-wake
 *  tick so a woken pod gets its own tier's resources, not a generic default. */
export async function resolvePodConfig(userId: string): Promise<PodConfig> {
  try {
    const info = await litellm.getUserInfo(userId);
    const tierName = info.user_info?.metadata?.tier || "free";
    return (getTierByName(tierName) ?? TIERS.free).pod;
  } catch {
    return TIERS.free.pod;
  }
}

/** Read the epoch-ms of a pod's `last-active` annotation, or null if unset. */
async function getLastActive(userId: string): Promise<number | null> {
  const ns = `user-${userId}`;
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
  userId: string,
  idle: boolean,
): Promise<"scaled-down" | "heartbeat" | "wake-race"> {
  if (!idle) {
    await annotateLastActive(userId);
    return "heartbeat";
  }
  const last = await getLastActive(userId);
  if (last !== null && Date.now() - last < WAKE_RACE_MS) return "wake-race";
  await scaleUserPod(userId, 0);
  console.log(`[self-idle] scaled down pod for ${userId} (self-reported idle)`);
  return "scaled-down";
}

// --- Public API ---

export async function getEnvVars(
  userId: string,
): Promise<Record<string, string>> {
  const ns = `user-${userId}`;
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
  userId: string,
  vars: Record<string, string>,
): Promise<void> {
  const ns = `user-${userId}`;
  const existing = await k8s(
    `/api/v1/namespaces/${ns}/secrets/user-env`,
    "GET",
  );
  if (existing) {
    await k8s(
      `/api/v1/namespaces/${ns}/secrets/user-env`,
      "PUT",
      envSecret(userId, vars),
    );
  } else {
    await k8s(
      `/api/v1/namespaces/${ns}/secrets`,
      "POST",
      envSecret(userId, vars),
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

export async function createUserPod(
  userId: string,
  pod: PodConfig = DEFAULT_POD_CONFIG,
): Promise<void> {
  const ns = `user-${userId}`;

  // Create namespace (skip if exists)
  const nsResult = await k8s("/api/v1/namespaces", "POST", namespace(userId));
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
      acrPullSecret(userId),
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
    dataPvc(userId),
  );
  if (pvcResult === "conflict") {
    console.log(`PVC in ${ns} already exists, skipping`);
  } else {
    console.log(`Created PVC in ${ns}`);
  }

  // Fetch the user's LiteLLM virtual key and build the initial env secret
  let litellmKey = "";
  try {
    litellmKey = await getLiteLLMKey(userId);
  } catch (err) {
    console.warn(`Could not fetch LiteLLM key for ${userId}: ${err}`);
  }
  // Seed the initial env with LiteLLM defaults + the pod→gateway compute creds
  // (scoped JWT + self-idle flag) so a fresh pod boots ready to self-report and
  // publish its cron manifest — no post-create restart needed.
  const computeJwt = await signComputeToken(userId);
  const initialEnv: Record<string, string> = {
    ...(litellmKey ? litellmEnvDefaults(litellmKey) : {}),
    LMTHING_COMPUTE_JWT: computeJwt,
    LMTHING_SELF_IDLE: "1",
  };

  // Create env secret with LiteLLM defaults (skip if exists — will be merged below)
  const envResult = await k8s(
    `/api/v1/namespaces/${ns}/secrets`,
    "POST",
    envSecret(userId, initialEnv),
  );
  if (envResult === "conflict") {
    console.log(`Env secret in ${ns} already exists, merging LiteLLM + compute keys`);
    // Secret already exists — merge defaults without clobbering user-set keys
    if (litellmKey) {
      await injectLiteLLMEnv(userId, litellmKey);
    }
    await injectComputeEnv(userId);
  } else {
    console.log(`Created env secret in ${ns}`);
  }

  // Create deployment (skip if exists)
  const depResult = await k8s(
    `/apis/apps/v1/namespaces/${ns}/deployments`,
    "POST",
    deployment(userId, pod),
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
    service(userId),
  );
  if (svcResult === "conflict") {
    console.log(`Service in ${ns} already exists, skipping`);
  } else {
    console.log(`Created service in ${ns}`);
  }
}

/**
 * Scale a user's compute deployment to the given replica count.
 * Typically called with replicas=0 (idle teardown) or replicas=1 (wake up).
 *
 * Idle sweep pattern (not wired as a background controller here — see stub below):
 *   The pod's agent server reports inactivity via its own /health or a sidecar.
 *   An external cron or the pod itself can call POST /api/compute/scale with
 *   replicas=0 when it detects that no sessions have been active for
 *   tier.pod.idleTtlMinutes minutes.  Alternatively, a future in-process
 *   timer in the gateway could periodically call getUserPodStatus and then
 *   scaleUserPod(userId, 0) for pods whose last-active annotation is stale.
 */
export async function scaleUserPod(
  userId: string,
  replicas: number,
): Promise<void> {
  const ns = `user-${userId}`;
  await k8s(
    `/apis/apps/v1/namespaces/${ns}/deployments/lmthing/scale`,
    "PATCH",
    { spec: { replicas } },
    "application/merge-patch+json",
  );
  console.log(`Scaled deployment in ${ns} to ${replicas} replica(s)`);
}

/**
 * Idempotent: bring the user's pod to a running state with the correct tier sizing.
 *
 * - If the namespace/deployment does not exist: create everything (via createUserPod).
 * - If the deployment exists but is scaled to 0: scale it to 1 and patch resources.
 * - If the deployment exists and is already running: patch resources to match the
 *   new tier (handles upgrades/downgrades) and no-op the replica count.
 *
 * Returns connection info the frontend needs to open a session.
 */
export async function ensureUserPod(
  userId: string,
  pod: PodConfig,
): Promise<{ host: string; port: number }> {
  const ns = `user-${userId}`;

  const dep = await k8s(
    `/apis/apps/v1/namespaces/${ns}/deployments/lmthing`,
    "GET",
  );

  if (!dep) {
    // First use — provision the full namespace + resources
    await createUserPod(userId, pod);
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
                  ],
                  // Migrate existing pods to the startup probe and REMOVE the old
                  // readiness probe (readinessProbe: null deletes it in a
                  // strategic-merge patch) — a readiness probe yanks a busy
                  // single-threaded pod out of the Service under its own load.
                  readinessProbe: null,
                  startupProbe: {
                    httpGet: { path: "/api/sessions", port: 8080 },
                    initialDelaySeconds: 1,
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

    // Ensure LiteLLM + compute env are present (idempotent merges).
    try {
      const litellmKey = await getLiteLLMKey(userId);
      await injectLiteLLMEnv(userId, litellmKey);
    } catch (err) {
      console.warn(`Could not inject LiteLLM env for ${userId}: ${err}`);
    }
    try {
      await injectComputeEnv(userId);
    } catch (err) {
      console.warn(`Could not inject compute env for ${userId}: ${err}`);
    }

    const currentReplicas = dep.spec?.replicas ?? 0;
    if (currentReplicas === 0) {
      await scaleUserPod(userId, 1);
      console.log(`Woke up scaled-to-zero pod for user ${userId}`);
    }
  }

  // Stamp the idle-sweep backstop clock — an ensure means the user is active.
  try {
    await annotateLastActive(userId);
  } catch (err) {
    console.warn(`Could not annotate last-active for ${userId}: ${err}`);
  }

  // Bounded wait for the pod to actually be serving before returning, so the
  // caller (SPA) connects to a ready pod instead of racing the cold-boot window
  // (Envoy has no ready endpoint until the startup probe passes → "connection
  // refused" 503s). Warm pods return on the first check (~no delay). Capped well
  // under the ~15s ingress timeout; a slower boot just returns not-ready and the
  // client polls /status.
  if (!LOCAL_DEV) {
    const deadline = Date.now() + WAKE_READY_WAIT_MS;
    while (Date.now() < deadline) {
      try {
        const st = await getUserPodStatus(userId);
        if (st.ready) break;
      } catch {
        /* transient — keep polling */
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  }

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
 * already carries its correct shape/env from the last `ensureUserPod`, so a plain
 * `scaleUserPod(1)` is enough; only a never-provisioned user needs the full
 * `createUserPod`. Idempotent + cheap, so every retry in the wake window is safe.
 */
export async function wakeUserPod(userId: string, pod: PodConfig): Promise<void> {
  const ns = `user-${userId}`;
  const dep = await k8s(
    `/apis/apps/v1/namespaces/${ns}/deployments/lmthing`,
    "GET",
  );
  if (!dep) {
    await createUserPod(userId, pod);
  } else if ((dep.spec?.replicas ?? 0) === 0) {
    await scaleUserPod(userId, 1);
    console.log(`[activator] woke scaled-to-zero pod for user ${userId}`);
  }
  // Stamp the idle-sweep backstop clock — a wake means the user is active.
  try {
    await annotateLastActive(userId);
  } catch (err) {
    console.warn(`Could not annotate last-active for ${userId}: ${err}`);
  }
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
export async function getPodProxyUrl(userId: string): Promise<string | null> {
  if (!LOCAL_DEV) return null;
  if (process.env.COMPUTE_LOCAL_URL) return process.env.COMPUTE_LOCAL_URL;
  const ns = `user-${userId}`;
  const svc = await k8s(`/api/v1/namespaces/${ns}/services/lmthing`, "GET");
  const nodePort = svc?.spec?.ports?.[0]?.nodePort as number | undefined;
  if (!nodePort) return null;
  const minikubeIp = process.env.MINIKUBE_IP ?? "192.168.49.2";
  return `http://${minikubeIp}:${nodePort}`;
}

/**
 * Backstop idle-sweep controller body. Enumerates every `user-*` namespace's
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
  const nsData = (await k8s("/api/v1/namespaces", "GET")) as {
    items?: Array<{ metadata?: { name?: string } }>;
  } | null;
  const userNs = (nsData?.items ?? [])
    .map((n) => n.metadata?.name ?? "")
    .filter((name) => name.startsWith("user-"));

  const now = Date.now();
  let scaledDown = 0;
  await Promise.allSettled(
    userNs.map(async (ns) => {
      const userId = ns.slice("user-".length);
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
        await annotateLastActive(userId, new Date(now).toISOString()).catch(() => {});
        return;
      }
      const lastMs = Date.parse(lastActive);
      if (Number.isFinite(lastMs) && now - lastMs < SWEEP_STALE_MS) return; // fresh

      await scaleUserPod(userId, 0);
      scaledDown++;
      console.log(
        `[sweep] scaled down stale pod ${ns} (last-active ${lastActive})`,
      );
    }),
  );
  if (scaledDown > 0 || userNs.length > 0) {
    console.log(`[sweep] scanned ${userNs.length} pod(s), scaled down ${scaledDown}`);
  }
  return { scanned: userNs.length, scaledDown };
}

export async function deleteUserPod(userId: string): Promise<void> {
  const ns = `user-${userId}`;

  // Delete the namespace — cascades to all resources within it
  const result = await k8s(`/api/v1/namespaces/${ns}`, "DELETE");
  if (result === null) {
    console.log(`Namespace ${ns} not found, nothing to delete`);
  } else {
    console.log(`Deleted namespace ${ns}`);
  }
  // Drop the user's externalized cron schedule so the wake tick stops targeting
  // a now-deleted pod.
  await deleteCronJobs(userId).catch((err) =>
    console.warn(`Could not delete cron jobs for ${userId}: ${err}`),
  );
}

export interface PodStatus {
  exists: boolean;
  ready: boolean;
  phase: string | null;
  /** The compute image tag that was set when the pod was last created or upgraded. */
  computeTag?: string;
}

export async function getUserPodStatus(userId: string): Promise<PodStatus> {
  const ns = `user-${userId}`;

  const dep = await k8s(
    `/apis/apps/v1/namespaces/${ns}/deployments/lmthing`,
    "GET",
  );

  if (!dep) {
    return { exists: false, ready: false, phase: null };
  }

  const readyReplicas = dep.status?.readyReplicas ?? 0;
  const phase =
    readyReplicas > 0
      ? "running"
      : dep.status?.conditions?.find(
            (c: { type: string }) => c.type === "Progressing",
          )
        ? "starting"
        : "pending";

  const computeTag: string | undefined =
    dep.spec?.template?.metadata?.annotations?.["lmthing.cloud/compute-tag"];

  return {
    exists: true,
    ready: readyReplicas > 0,
    phase,
    ...(computeTag ? { computeTag } : {}),
  };
}

/**
 * Trigger a rolling restart of the user's compute pod, updating the
 * compute-tag annotation so the new image version is tracked.
 * Since imagePullPolicy is Always and the image uses :latest, the new pod
 * will pull the latest compute image from ACR.
 */
export async function restartUserPod(userId: string): Promise<void> {
  const ns = `user-${userId}`;
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
  console.log(`Triggered rolling restart for user ${userId} pod`);
}
