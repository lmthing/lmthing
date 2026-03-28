import { readFileSync } from "node:fs";

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

function deployment(userId: string) {
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
                requests: { memory: "1Gi", cpu: "500m" },
                limits: { memory: "1Gi", cpu: "500m" },
              },
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

export async function createUserPod(userId: string): Promise<void> {
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
    deployment(userId),
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
