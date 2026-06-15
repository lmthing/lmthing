import { readFileSync } from "node:fs";
import type { PodConfig } from "./tiers.js";

// In-cluster K8s API config (service account auto-mounted by K8s)
const K8S_API = process.env.KUBERNETES_SERVICE_HOST
  ? `https://${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_SERVICE_PORT}`
  : "https://kubernetes.default.svc";

const TOKEN_PATH = "/var/run/secrets/kubernetes.io/serviceaccount/token";

function getToken(): string {
  return readFileSync(TOKEN_PATH, "utf-8").trim();
}

async function k8s(
  path: string,
  method: string,
  body?: unknown,
  contentType = "application/json",
) {
  const res = await fetch(`${K8S_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getToken()}`,
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

// ACR credentials injected from lmthing-secrets
const ACR_REGISTRY = process.env.ACR_REGISTRY ?? "lmthingacr.azurecr.io";
const ACR_USERNAME = process.env.ACR_USERNAME ?? "";
const ACR_PASSWORD = process.env.ACR_PASSWORD ?? "";
const COMPUTE_IMAGE = `${ACR_REGISTRY}/compute:latest`;
const PULL_SECRET_NAME = "acr-pull-secret";

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
        },
        spec: {
          imagePullSecrets: [{ name: PULL_SECRET_NAME }],
          containers: [
            {
              name: "compute",
              image: COMPUTE_IMAGE,
              imagePullPolicy: "IfNotPresent",
              ports: [{ containerPort: 8080 }],
              resources: {
                requests: { memory: pod.mem, cpu: pod.cpu },
                limits: { memory: pod.mem, cpu: pod.cpu },
              },
              env: [
                {
                  name: "MAX_SESSIONS",
                  value: String(pod.maxSessions),
                },
                {
                  name: "IDLE_TTL_MINUTES",
                  value: String(pod.idleTtlMinutes),
                },
              ],
              envFrom: [{ secretRef: { name: "user-env", optional: true } }],
              volumeMounts: [{ name: "spaces", mountPath: "/data/spaces" }],
            },
          ],
          volumes: [
            {
              name: "spaces",
              emptyDir: { sizeLimit: "1Gi" },
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

  // Create ACR pull secret (skip if exists)
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

  // Create env secret (skip if exists)
  const envResult = await k8s(
    `/api/v1/namespaces/${ns}/secrets`,
    "POST",
    envSecret(userId, {}),
  );
  if (envResult === "conflict") {
    console.log(`Env secret in ${ns} already exists, skipping`);
  } else {
    console.log(`Created env secret in ${ns}`);
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
    // Patch resources + env vars to match current tier (handles tier changes)
    await k8s(
      `/apis/apps/v1/namespaces/${ns}/deployments/lmthing`,
      "PATCH",
      {
        spec: {
          template: {
            spec: {
              containers: [
                {
                  name: "compute",
                  resources: {
                    requests: { memory: pod.mem, cpu: pod.cpu },
                    limits: { memory: pod.mem, cpu: pod.cpu },
                  },
                  env: [
                    { name: "MAX_SESSIONS", value: String(pod.maxSessions) },
                    {
                      name: "IDLE_TTL_MINUTES",
                      value: String(pod.idleTtlMinutes),
                    },
                  ],
                },
              ],
            },
          },
        },
      },
      "application/strategic-merge-patch+json",
    );

    const currentReplicas = dep.spec?.replicas ?? 0;
    if (currentReplicas === 0) {
      await scaleUserPod(userId, 1);
      console.log(`Woke up scaled-to-zero pod for user ${userId}`);
    }
  }

  // In-cluster DNS for the user's service
  return {
    host: `lmthing.${ns}.svc.cluster.local`,
    port: 8080,
  };
}

/**
 * Stub for a future idle-sweep controller.
 *
 * This function is intentionally not wired to a background timer here —
 * the gateway is stateless and managing per-user timers adds complexity.
 * Recommended approaches:
 *   1. The compute pod self-reports: when idle for idleTtlMinutes, it calls
 *      scaleUserPod(userId, 0) via the in-cluster K8s API or a sidecar.
 *   2. A dedicated CronJob in the lmthing namespace queries all user-* namespaces,
 *      checks the last-active annotation, and scales idle pods to zero.
 *   3. A future gateway background task (e.g. using setInterval at startup)
 *      calls this function periodically.
 *
 * @param userIds - list of userIds whose pods should be checked and scaled to 0 if idle
 */
export async function scaleIdlePodsToZero(userIds: string[]): Promise<void> {
  // STUB — iterate userIds, check pod status and last-active annotation,
  // call scaleUserPod(userId, 0) for pods past their idleTtlMinutes threshold.
  console.log(
    `scaleIdlePodsToZero: stub called for ${userIds.length} user(s)`,
  );
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
}

export interface PodStatus {
  exists: boolean;
  ready: boolean;
  phase: string | null;
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

  return {
    exists: true,
    ready: readyReplicas > 0,
    phase,
  };
}
