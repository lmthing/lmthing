import { describe, it, expect, beforeEach, vi } from "vitest";

// The K8s client talks over global fetch, so stubbing fetch lets these tests
// assert the EXACT requests a provisioning run makes — the regression guard that
// matters when generalizing pod provisioning from users to principals.
vi.mock("./db.js", () => ({ deleteCronJobs: vi.fn(async () => undefined) }));
vi.mock("./litellm.js", () => ({
  createUser: vi.fn(async () => ({})),
  generateKey: vi.fn(async () => ({ key: "sk-test" })),
  getUserInfo: vi.fn(async () => ({ user_info: { metadata: { tier: "free" } } })),
}));

// Talk to a fake API server and skip the service-account token file.
process.env.K8S_LOCAL_PROXY = "true";
process.env.K8S_API_URL = "http://k8s.test";

const {
  createPod,
  nsOf,
  principalKey,
  parsePrincipalKey,
  userPrincipal,
  teamPrincipal,
  getEnvVars,
  injectLiteLLMEnv,
  sweepIdlePods,
} = await import("./compute.js");
const { TIERS } = await import("./tiers.js");

interface Call {
  path: string;
  method: string;
  body: any;
}
let calls: Call[] = [];

/** Stub the K8s API. `existing` lists paths that should answer 200 instead of 404. */
function stubK8s(handler?: (path: string, method: string) => unknown) {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: any) => {
      const path = String(url).replace("http://k8s.test", "");
      const method = init?.method ?? "GET";
      calls.push({ path, method, body: init?.body ? JSON.parse(init.body) : undefined });
      const result = handler?.(path, method);
      if (result === undefined) {
        // Default: nothing exists yet, and every write succeeds.
        if (method === "GET") return new Response("", { status: 404 });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response(JSON.stringify(result), { status: 200 });
    }),
  );
}

function sent(pathIncludes: string, method = "POST") {
  return calls.find((c) => c.path.includes(pathIncludes) && c.method === method);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("managed model allowlist", () => {
  it("includes gpt-5.6-luna in every tier", () => {
    for (const tier of Object.values(TIERS)) {
      expect(tier.models).toContain("gpt-5.6-luna");
    }
  });
});

describe("injectLiteLLMEnv — propagating a changed default model", () => {
  /** base64-encode/decode a user-env Secret's `data`, as k8s stores it. */
  const enc = (vars: Record<string, string>) =>
    Object.fromEntries(
      Object.entries(vars).map(([k, v]) => [k, Buffer.from(v).toString("base64")]),
    );
  const dec = (data: Record<string, string>) =>
    Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, Buffer.from(v, "base64").toString()]),
    );

  /**
   * injectLiteLLMEnv's merge used to be non-clobbering (`{...defaults, ...existing}`),
   * so a pod provisioned under an OLD default kept its stale LM_MODEL_M forever — a
   * restart just re-read the same Secret. The model aliases are now force-overwritten,
   * so a changed default reaches EXISTING pods (the /ensure `modelStale` gate calls this)
   * and rolls them. This pins both halves: a stale alias is rewritten AND the deployment
   * is rolled, then a second pass over the now-current env writes nothing — the
   * steady-state no-op that keeps the /ensure hot path from rolling every pod every load.
   */
  it("overwrites a stale alias, rolls the pod, then no-ops once current", async () => {
    let current: Record<string, string> = {
      LMTHINGCLOUD_API_KEY: "sk-test",
      LMTHING_COMPUTE_JWT: "j",
      LMTHING_SELF_IDLE: "i",
      LMTHINGCLOUD_BASE_URL: "http://litellm.lmthing.svc.cluster.local:4000/v1",
      LMTHING_GATEWAY_URL: "http://gateway.lmthing.svc.cluster.local:3000",
      RENDER_SERVICE_URL: "http://render.lmthing.svc.cluster.local:3000",
      RENDER_SERVICE_TOKEN: process.env.RENDER_SERVICE_TOKEN ?? "",
      LM_MODEL_XS: "lmthingcloud:DeepSeek-V4-Flash-0731",
      LM_MODEL_S: "lmthingcloud:DeepSeek-V4-Flash-0731",
      LM_MODEL_M: "lmthingcloud:gpt-5.6-luna", // ← stale default
      LM_MODEL_L: "lmthingcloud:DeepSeek-V4-Pro",
      LM_MODEL_M_R: "lmthingcloud:DeepSeek-V4-Pro",
      LM_MODEL_L_R: "lmthingcloud:Kimi-K2.6",
      LM_MODEL_VISION: "lmthingcloud:gpt-5.4-mini",
      LM_TRANSCRIBE_MODEL: "lmthingcloud:whisper-1",
    };
    stubK8s((path, method) => {
      if (method === "GET" && path.includes("/secrets/user-env")) {
        return { data: enc(current) };
      }
      return undefined;
    });

    await injectLiteLLMEnv(userPrincipal("1"), "sk-test");

    const put = sent("/secrets/user-env", "PUT");
    expect(put).toBeTruthy();
    expect(Buffer.from(put.body.data.LM_MODEL_M, "base64").toString()).toBe(
      "lmthingcloud:DeepSeek-V4-Flash-0731",
    );
    // setEnvVars rolls the pod via a template-annotation PATCH on the deployment.
    expect(sent("/deployments/lmthing", "PATCH")).toBeTruthy();

    // Feed the just-written canonical env back as "existing": every gateway-owned
    // key now matches, so a second pass must NOT write or roll.
    current = dec(put.body.data);
    calls = [];
    await injectLiteLLMEnv(userPrincipal("1"), "sk-test");
    expect(sent("/secrets/user-env", "PUT")).toBeUndefined();
    expect(sent("/deployments/lmthing", "PATCH")).toBeUndefined();
  });
});

describe("principal identity", () => {
  it("maps a user to their existing namespace and bare key", () => {
    const p = userPrincipal("379847");
    expect(nsOf(p)).toBe("user-379847");
    // A user's key must stay the bare id — every pre-existing DB row, LiteLLM
    // user and scoped token is keyed on it.
    expect(principalKey(p)).toBe("379847");
  });

  it("maps a team to a team namespace, where key and namespace coincide", () => {
    const p = teamPrincipal("abc-123");
    expect(nsOf(p)).toBe("team-abc-123");
    expect(principalKey(p)).toBe("team-abc-123");
  });

  it("round-trips every principal through its key", () => {
    for (const p of [userPrincipal("379847"), teamPrincipal("abc-123")]) {
      expect(parsePrincipalKey(principalKey(p))).toEqual(p);
    }
  });

  it("reads a bare user id as a user, even one containing 'team'", () => {
    expect(parsePrincipalKey("379847")).toEqual(userPrincipal("379847"));
    expect(parsePrincipalKey("my-team-99")).toEqual(userPrincipal("my-team-99"));
  });
});

describe("createPod — user principal (regression: unchanged shape)", () => {
  beforeEach(async () => {
    stubK8s();
    await createPod(userPrincipal("379847"), TIERS.free.pod);
  });

  it("provisions into user-<id> with the historical resource names", () => {
    expect(sent("/api/v1/namespaces", "POST")?.body.metadata.name).toBe("user-379847");
    expect(sent("/persistentvolumeclaims")?.body.metadata.name).toBe("user-data");
    expect(sent("/deployments")?.body.metadata.name).toBe("lmthing");
    expect(sent("/services")?.body.metadata.name).toBe("lmthing");
    for (const c of calls) {
      expect(c.path).not.toContain("team-");
    }
  });

  it("keeps the lmthing.cloud/user label that existing tooling selects on", () => {
    const ns = sent("/api/v1/namespaces", "POST")!.body;
    expect(ns.metadata.labels).toMatchObject({
      "lmthing.cloud/user": "379847",
      "lmthing.cloud/type": "compute",
    });
    const dep = sent("/deployments")!.body;
    expect(dep.spec.template.metadata.labels).toMatchObject({
      app: "compute",
      "lmthing.cloud/user": "379847",
    });
  });

  /**
   * The provisioned model env, pinned as a whole.
   *
   * A fresh pod used to get `LM_MODEL=openai:gpt-5.4-nano` plus `OPENAI_BASE_URL`/`OPENAI_API_KEY`
   * pointed at LiteLLM, while every per-role alias was an Azure DeepSeek model. So a freeform THING
   * turn ran on openai/gpt and its own forks and delegates ran on azure — the DEFAULT was the odd
   * one out, and a stall on the default model was indistinguishable from a stall anywhere else.
   * (Observed 2026-06-28; the issue file is deleted now that this case stands in for it.)
   *
   * The provider refactor fixed it by DELETING the bare default rather than setting it: with
   * `LM_MODEL` absent, `bin.ts` falls back to the alias `M`, which `resolveAlias` reads from
   * `LM_MODEL_M` — the same value a fork resolves. The default cannot diverge from the aliases
   * because it IS one of them. Setting `LM_MODEL` here again would reintroduce the divergence, so
   * its ABSENCE is the assertion.
   */
  it("provisions no default model that can diverge from the role aliases", () => {
    // The user-env secret BY NAME. `sent("/secrets")` finds the ACR image-pull secret first,
    // which carries none of these keys — so a test written against it passes no matter what the
    // model env contains, which is the trap this comment exists to stop.
    const envSecret = calls.find(
      (c) => c.method === "POST" && c.path.includes("/secrets") && c.body?.metadata?.name === "user-env",
    );
    const data = envSecret!.body.data as Record<string, string>;

    // A bare LM_MODEL is a second source of truth for "which model" — see above.
    expect(Object.keys(data)).not.toContain("LM_MODEL");

    // The OpenAI-shaped vars are gone entirely; model traffic goes through the
    // `lmthingcloud:` provider, which bills against the user's own LiteLLM key.
    expect(Object.keys(data).filter((k) => k.startsWith("OPENAI_"))).toEqual([]);

    // And every alias that IS provisioned names that provider, so none of them can quietly
    // reach a different one.
    const aliases = Object.keys(data).filter((k) => /^LM_(MODEL|TRANSCRIBE)_/.test(k));
    expect(aliases.length).toBeGreaterThan(0);
    for (const key of aliases) {
      expect(Buffer.from(data[key]!, "base64").toString()).toMatch(/^lmthingcloud:/);
    }
    expect(Buffer.from(data.LM_MODEL_M!, "base64").toString()).toBe(
      "lmthingcloud:DeepSeek-V4-Flash-0731",
    );
  });

  it("does NOT put a user pod into team mode", () => {
    const env = sent("/deployments")!.body.spec.template.spec.containers[0].env;
    expect(env.map((e: any) => e.name)).not.toContain("LMTHING_TEAM_MODE");
  });

  // A team pod gates every route on the identity headers Envoy projects, but the
  // kubelet probes from inside the cluster with no headers at all. Probing a
  // gated route 401s, the startup probe never passes, and the pod crash-loops.
  // /api/health is the one path served without a caller — see team-guard.ts.
  it("probes a path an anonymous in-cluster caller can reach", () => {
    const probe = sent("/deployments")!.body.spec.template.spec.containers[0].startupProbe;
    expect(probe.httpGet.path).toBe("/api/health");
  });
});

describe("createPod — team principal", () => {
  beforeEach(async () => {
    stubK8s();
    await createPod(teamPrincipal("abc-123"), TIERS.free.pod);
  });

  it("provisions an identical pod in team-<id>", () => {
    expect(sent("/api/v1/namespaces", "POST")?.body.metadata.name).toBe("team-abc-123");
    // Same names inside the namespace — the namespace is the only difference.
    expect(sent("/deployments")?.body.metadata.namespace).toBe("team-abc-123");
    expect(sent("/deployments")?.body.metadata.name).toBe("lmthing");
    expect(sent("/services")?.body.metadata.namespace).toBe("team-abc-123");
  });

  it("labels by principal and omits the user-only label", () => {
    const labels = sent("/api/v1/namespaces", "POST")!.body.metadata.labels;
    expect(labels["lmthing.cloud/principal"]).toBe("team-abc-123");
    expect(labels["lmthing.cloud/user"]).toBeUndefined();
    expect(labels["lmthing.cloud/type"]).toBe("compute");
  });

  it("turns on team mode as CONTAINER env, out of reach of PUT /env", () => {
    // A team editor's replace-all env write must not be able to drop this key
    // and silently disable the pod's viewer/editor guard.
    const container = sent("/deployments")!.body.spec.template.spec.containers[0];
    expect(container.env).toContainEqual({ name: "LMTHING_TEAM_MODE", value: "1" });
    // It is NOT part of the user-env secret the API exposes for editing.
    expect(sent("/secrets")?.body.data?.LMTHING_TEAM_MODE).toBeUndefined();
  });

  it("gives the team its own LiteLLM key, aliased so it can't collide", async () => {
    const litellm = await import("./litellm.js");
    expect(vi.mocked(litellm.generateKey)).toHaveBeenCalledWith(
      "team-abc-123",
      expect.anything(),
      "compute-team-abc-123",
    );
  });
});

describe("getEnvVars", () => {
  it("reads the secret from the principal's own namespace", async () => {
    stubK8s((path) =>
      path.includes("/secrets/user-env")
        ? { data: { FOO: Buffer.from("bar").toString("base64") } }
        : undefined,
    );
    expect(await getEnvVars(teamPrincipal("abc-123"))).toEqual({ FOO: "bar" });
    expect(calls[0]!.path).toBe("/api/v1/namespaces/team-abc-123/secrets/user-env");
  });
});

describe("sweepIdlePods", () => {
  it("selects compute namespaces by label, so team pods are swept too", async () => {
    stubK8s((path) => {
      if (path.startsWith("/api/v1/namespaces?")) {
        return {
          items: [
            { metadata: { name: "user-379847" } },
            { metadata: { name: "team-abc-123" } },
          ],
        };
      }
      if (path.includes("/deployments/lmthing")) {
        // Running, and stale enough to sweep.
        return {
          spec: { replicas: 1 },
          metadata: {
            annotations: {
              "lmthing.cloud/last-active": new Date(Date.now() - 86_400_000).toISOString(),
            },
          },
        };
      }
      return undefined;
    });

    const result = await sweepIdlePods();

    // Name-prefix filtering would have missed the team namespace entirely.
    expect(calls[0]!.path).toContain("labelSelector=lmthing.cloud%2Ftype%3Dcompute");
    expect(result).toEqual({ scanned: 2, scaledDown: 2 });
    // The sweep runs its namespaces concurrently, so compare as a set.
    const scaled = calls.filter((c) => c.path.endsWith("/scale"));
    expect(scaled.map((c) => c.path).sort()).toEqual([
      "/apis/apps/v1/namespaces/team-abc-123/deployments/lmthing/scale",
      "/apis/apps/v1/namespaces/user-379847/deployments/lmthing/scale",
    ]);
    expect(scaled.every((c) => c.body.spec.replicas === 0)).toBe(true);
  });
});
