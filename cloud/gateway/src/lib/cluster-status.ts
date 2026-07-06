import {
  k8s,
  sweepIdlePods,
  ensureUserPod,
  resolvePodConfig,
} from "./compute.js";
import {
  claimTick,
  selectDueCronJobs,
  markCronWoken,
} from "./db.js";

// --- Types ---
interface Deployment {
  name: string;
  image: string;
  tag: string;
  desired: number;
  ready: number;
  available: number;
  conditions: Array<{ type: string; status: string; reason?: string; message?: string }>;
  age: string;
}

interface PodSummary {
  name: string;
  phase: string;
  ready: boolean;
  restartCount: number;
  startTime: string | null;
  waitingReason?: string;
}

interface ServiceSummary {
  name: string;
  image: string;
  tag: string;
  desired: number;
  ready: number;
  available: number;
  rolloutState: string;
  pods: PodSummary[];
  age: string;
}

interface ComputeFleet {
  total: number;
  ready: number;
  notReady: number;
  namespaces: string[];
}

interface K8sEvent {
  reason: string;
  message: string;
  involvedObject: string;
  namespace: string;
  lastTimestamp: string;
  count: number;
}

// --- K8s helpers ---
function parseAge(timestamp: string): string {
  const ms = Date.now() - new Date(timestamp).getTime();
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

function parseTag(image: string): string {
  const m = image.match(/:([a-zA-Z0-9._-]+)$/);
  return m ? m[1] : image;
}

async function k8sGet(path: string): Promise<unknown> {
  return await k8s(path, "GET");
}

async function fetchDeployments(ns: string): Promise<Deployment[]> {
  const data = await k8sGet(`/apis/apps/v1/namespaces/${ns}/deployments`) as any;
  if (!data?.items) return [];
  return data.items.map((d: any) => ({
    name: d.metadata.name as string,
    image: d.spec?.template?.spec?.containers?.[0]?.image ?? "",
    tag: parseTag(d.spec?.template?.spec?.containers?.[0]?.image ?? ""),
    desired: d.spec?.replicas ?? 0,
    ready: d.status?.readyReplicas ?? 0,
    available: d.status?.availableReplicas ?? 0,
    conditions: (d.status?.conditions ?? []).map((c: any) => ({
      type: c.type as string,
      status: c.status as string,
      reason: c.reason as string | undefined,
      message: c.message as string | undefined,
    })),
    age: parseAge(d.metadata.creationTimestamp as string),
  }));
}

async function fetchPods(ns: string): Promise<PodSummary[]> {
  const data = await k8sGet(`/api/v1/namespaces/${ns}/pods`) as any;
  if (!data?.items) return [];
  // cap at 100 pods per namespace
  const items = (data.items as any[]).slice(0, 100);
  return items.map((p: any) => {
    const containerStatuses: any[] = p.status?.containerStatuses ?? [];
    const restartCount = containerStatuses.reduce((s: number, c: any) => s + (c.restartCount ?? 0), 0);
    const waitingReason = containerStatuses[0]?.state?.waiting?.reason as string | undefined;
    const ready = containerStatuses.every((c: any) => c.ready === true) && containerStatuses.length > 0;
    return {
      name: p.metadata.name as string,
      phase: p.status?.phase ?? "Unknown",
      ready,
      restartCount,
      startTime: p.status?.startTime ?? null,
      ...(waitingReason ? { waitingReason } : {}),
    };
  });
}

async function fetchComputeFleet(): Promise<ComputeFleet> {
  const data = await k8sGet("/api/v1/namespaces") as any;
  if (!data?.items) return { total: 0, ready: 0, notReady: 0, namespaces: [] };
  const userNs: string[] = (data.items as any[])
    .map((n: any) => n.metadata.name as string)
    .filter((name: string) => name.startsWith("user-"));

  // Check deployment ready state for each user namespace (in parallel, max 50)
  const sample = userNs.slice(0, 50);
  const results = await Promise.allSettled(
    sample.map(async (ns) => {
      const dep = await k8sGet(`/apis/apps/v1/namespaces/${ns}/deployments/lmthing`) as any;
      return dep ? (dep.status?.readyReplicas ?? 0) > 0 : false;
    })
  );
  const ready = results.filter(r => r.status === "fulfilled" && r.value === true).length;
  return {
    total: userNs.length,
    ready,
    notReady: userNs.length - ready,
    namespaces: userNs.slice(0, 20), // surface first 20
  };
}

async function fetchEvents(ns: string): Promise<K8sEvent[]> {
  const data = await k8sGet(`/api/v1/namespaces/${ns}/events?fieldSelector=type%3DWarning`) as any;
  if (!data?.items) return [];
  const items = (data.items as any[])
    .sort((a: any, b: any) => new Date(b.lastTimestamp ?? b.eventTime ?? 0).getTime() - new Date(a.lastTimestamp ?? a.eventTime ?? 0).getTime())
    .slice(0, 50);
  return items.map((e: any) => ({
    reason: e.reason ?? "",
    message: e.message ?? "",
    involvedObject: `${e.involvedObject?.kind}/${e.involvedObject?.name}`,
    namespace: ns,
    lastTimestamp: e.lastTimestamp ?? e.eventTime ?? "",
    count: e.count ?? 1,
  }));
}

// --- Cache ---
interface Cache {
  cluster: string | null;
  fleet: string | null;
  events: string | null;
  updatedAt: string | null;
  initialized: boolean;
}

const cache: Cache = { cluster: null, fleet: null, events: null, updatedAt: null, initialized: false };

let k8sCallCount = 0; // debug counter — logs only, not exposed

async function refreshCluster() {
  try {
    k8sCallCount++;
    const [deployments, pods] = await Promise.all([
      fetchDeployments("lmthing"),
      fetchPods("lmthing"),
    ]);
    // Join pods to deployments by app label prefix heuristic
    const podsByDeployment: Record<string, PodSummary[]> = {};
    for (const pod of pods) {
      // pod name is typically <deployment>-<replicaset>-<random>
      const dep = deployments.find(d => pod.name.startsWith(d.name + "-"));
      const key = dep ? dep.name : "_unmatched";
      (podsByDeployment[key] ??= []).push(pod);
    }
    const services: ServiceSummary[] = deployments.map(dep => {
      const rolloutCond = dep.conditions.find(c => c.type === "Progressing");
      const availCond = dep.conditions.find(c => c.type === "Available");
      let rolloutState = "Unknown";
      if (availCond?.status === "True" && dep.ready >= dep.desired && dep.desired > 0) {
        rolloutState = "Healthy";
      } else if (rolloutCond?.reason === "NewReplicaSetAvailable") {
        rolloutState = "Healthy";
      } else if (rolloutCond?.reason === "ReplicaSetUpdated") {
        rolloutState = "Rollout";
      } else if (availCond?.status === "False") {
        rolloutState = "Degraded";
      } else if (dep.desired === 0) {
        rolloutState = "Scaled down";
      }
      return {
        name: dep.name,
        image: dep.image,
        tag: dep.tag,
        desired: dep.desired,
        ready: dep.ready,
        available: dep.available,
        rolloutState,
        pods: podsByDeployment[dep.name] ?? [],
        age: dep.age,
      };
    });
    cache.cluster = JSON.stringify({ services, updatedAt: new Date().toISOString() });
    cache.updatedAt = new Date().toISOString();
    if (!cache.initialized) cache.initialized = true;
  } catch (err) {
    console.warn("[cluster-status] cluster refresh failed:", err);
  }
}

async function refreshFleetAndEvents() {
  try {
    k8sCallCount++;
    const [fleet, events] = await Promise.all([
      fetchComputeFleet(),
      fetchEvents("lmthing"),
    ]);
    cache.fleet = JSON.stringify({ ...fleet, updatedAt: new Date().toISOString() });
    cache.events = JSON.stringify({ events, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.warn("[cluster-status] fleet/events refresh failed:", err);
  }
}

let started = false;

// ─── Leader-locked controller ticks (scale-to-zero + externalized cron) ───────

const SWEEP_TICK_MS = 60_000;
const CRON_TICK_MS = 60_000;
const CRON_BATCH_LIMIT = 200; // max pods woken per cron tick
const CRON_WAKE_COOLDOWN_MS = 5 * 60_000; // don't re-wake a still-booting pod
const WAKE_CONCURRENCY = 8; // bounded fan-out so a wake burst doesn't hammer K8s

/**
 * One cron-wake pass: find jobs whose `next_run_at` has arrived, group by user
 * (one wake per user), and wake each pod with bounded concurrency. The pod's boot
 * catch-up runs the due hooks and republishes its manifest (advancing next_run_at),
 * then idles back to zero. `markCronWoken` stamps a cooldown so a still-booting pod
 * isn't re-woken next tick.
 */
async function cronWakeTick(): Promise<void> {
  const due = await selectDueCronJobs(CRON_BATCH_LIMIT, CRON_WAKE_COOLDOWN_MS);
  if (due.length === 0) return;
  const users = [...new Set(due.map((j) => j.user_id))];
  console.log(
    `[cron-wake] ${due.length} due job(s) across ${users.length} user(s)`,
  );
  let i = 0;
  const worker = async (): Promise<void> => {
    while (i < users.length) {
      const userId = users[i++]!;
      try {
        const pod = await resolvePodConfig(userId);
        await ensureUserPod(userId, pod);
      } catch (err) {
        console.warn(
          `[cron-wake] wake failed for ${userId}:`,
          err instanceof Error ? err.message : err,
        );
      } finally {
        await markCronWoken(userId).catch(() => {});
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(WAKE_CONCURRENCY, users.length) }, worker),
  );
}

export function startRefresher() {
  if (started) return;
  started = true;
  // Initial fetch
  void refreshCluster();
  void refreshFleetAndEvents();
  // Periodic polls
  setInterval(() => void refreshCluster(), 5000);
  setInterval(() => void refreshFleetAndEvents(), 10000);

  // Controller ticks — `claimTick` records the last run in Postgres and admits at
  // most one execution per ~tick across BOTH replicas (their 60s intervals are
  // offset, so a plain advisory lock — which only blocks simultaneous runs —
  // wouldn't dedupe them). Spacing is 0.8× the interval so a legit next tick isn't
  // starved while an offset replica's tick is suppressed.
  setInterval(() => {
    void (async () => {
      if (await claimTick("idle-sweep", SWEEP_TICK_MS * 0.8)) await sweepIdlePods();
    })().catch((err) =>
      console.warn("[sweep] tick failed:", err instanceof Error ? err.message : err),
    );
  }, SWEEP_TICK_MS);
  setInterval(() => {
    void (async () => {
      if (await claimTick("cron-wake", CRON_TICK_MS * 0.8)) await cronWakeTick();
    })().catch((err) =>
      console.warn("[cron-wake] tick failed:", err instanceof Error ? err.message : err),
    );
  }, CRON_TICK_MS);

  console.log("[cluster-status] background refresher + controllers started");
}

// Getters — only read cache, never call K8s
export function getClusterCache(): string | null { return cache.cluster; }
export function getFleetCache(): string | null { return cache.fleet; }
export function getEventsCache(): string | null { return cache.events; }
export function isInitialized(): boolean { return cache.initialized; }
export function getK8sCallCount(): number { return k8sCallCount; }

// SSE subscriber management
type Subscriber = (data: string) => void;
const subscribers = new Set<Subscriber>();

export function addSubscriber(fn: Subscriber) { subscribers.add(fn); }
export function removeSubscriber(fn: Subscriber) { subscribers.delete(fn); }
export function getSubscriberCount(): number { return subscribers.size; }

// Push combined snapshot to all SSE subscribers (called by refresher)
setInterval(() => {
  if (subscribers.size === 0 || !cache.cluster) return;
  const payload = JSON.stringify({
    cluster: cache.cluster ? JSON.parse(cache.cluster) : null,
    fleet: cache.fleet ? JSON.parse(cache.fleet) : null,
    events: cache.events ? JSON.parse(cache.events) : null,
  });
  for (const fn of subscribers) {
    try { fn(payload); } catch { /* ignore disconnected client */ }
  }
}, 5000);
