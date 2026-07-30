import { describe, it, expect } from "vitest";

process.env.K8S_LOCAL_PROXY = "true";
process.env.K8S_API_URL = "http://k8s.test";

const { memoryBudget } = await import("./compute.js");
const { TIERS } = await import("./tiers.js");

/**
 * The pod's memory budget has to ADD UP.
 *
 * This suite exists because it didn't, and nothing said so. The three consumers of a pod's memory
 * were sized independently and never summed against the container limit:
 *
 *   - V8's old space was `limit * 0.6`
 *   - every QuickJS VM took a hardcoded 64MiB default, OFF-heap, invisible to that cap
 *   - `maxConcurrentForks` permitted four of them at once
 *
 * On the free tier that is 307 + 4×64 + ~60 baseline = 623MiB against a 512MiB limit. The pod was
 * OOMKilled mid-turn (exit 137) on an ordinary question, the session died with the container, and
 * the user was charged for tokens that produced no answer.
 *
 * Every case here is arithmetic. That is the point: this class of bug is a sum, so it belongs in a
 * test rather than in a production pod.
 */

/** Kubernetes quantity → MiB. Mirrors `memToMiB`, deliberately re-implemented so a bug in that
 *  parser cannot make the assertions agree with it. */
function limitMiB(mem: string): number {
  const m = /^(\d+(?:\.\d+)?)\s*(Mi|Gi|M|G)?$/.exec(mem.trim())!;
  const n = Number(m[1]);
  if (m[2] === "Gi") return n * 1024;
  if (m[2] === "G") return (n * 1e9) / (1024 * 1024);
  if (m[2] === "M") return (n * 1e6) / (1024 * 1024);
  return n;
}

const NODE_BASELINE_MIB = 128;
const tiers = Object.values(TIERS).map((t) => ({ name: (t as { name: string }).name, pod: (t as { pod: { mem: string } }).pod }));

describe("pod memory budget", () => {
  it("covers every tier (so a new tier cannot skip these checks)", () => {
    expect(tiers.length).toBeGreaterThan(0);
    for (const t of tiers) expect(t.pod?.mem).toBeTruthy();
  });

  for (const { name, pod } of tiers) {
    describe(`${name} (${pod.mem})`, () => {
      it("fits inside the container limit, with the sandboxes counted", () => {
        const { v8MiB, vmMiB, maxConcurrentForks } = memoryBudget(pod as never);
        const total = NODE_BASELINE_MIB + v8MiB + vmMiB * maxConcurrentForks;

        // The whole bug in one assertion: every sandbox that MAY exist at once is counted, not
        // just the one that usually does.
        expect(total).toBeLessThanOrEqual(limitMiB(pod.mem));
      });

      it("leaves headroom rather than planning to the last byte", () => {
        const { v8MiB, vmMiB, maxConcurrentForks } = memoryBudget(pod as never);
        const total = NODE_BASELINE_MIB + v8MiB + vmMiB * maxConcurrentForks;

        // Fragmentation, a GC that has not run, native overhead. Planning to 100% is planning to
        // be killed by the first thing nobody modelled.
        expect(total).toBeLessThanOrEqual(limitMiB(pod.mem) * 0.9);
      });

      it("gives V8 enough to run the host at all", () => {
        // Below roughly this the host thrashes and a pod that cannot run is worse than one that
        // delegates less — which is why small pods buy fewer sandboxes, not a smaller heap.
        expect(memoryBudget(pod as never).v8MiB).toBeGreaterThanOrEqual(128);
      });

      it("can still run at least one sandbox", () => {
        const { vmMiB, maxConcurrentForks } = memoryBudget(pod as never);
        expect(maxConcurrentForks).toBeGreaterThanOrEqual(1);
        expect(vmMiB).toBeGreaterThanOrEqual(32);
      });
    });
  }

  it("scales with the pod rather than being a fixed fraction", () => {
    const small = memoryBudget({ mem: "512Mi" } as never);
    const large = memoryBudget({ mem: "2Gi" } as never);
    expect(large.v8MiB).toBeGreaterThan(small.v8MiB);
    // A bigger pod buys more concurrency; the old flat 60% gave every pod the same fan-out
    // regardless of whether it could afford it.
    expect(large.maxConcurrentForks).toBeGreaterThanOrEqual(small.maxConcurrentForks);
  });

  it("rejects the OLD sizing — the regression this suite exists for", () => {
    // What the code used to do, reproduced exactly: 60% of the limit for V8, four 64MiB VMs, and
    // no one adding them together.
    const oldV8 = Math.max(128, Math.floor(512 * 0.6));
    const oldTotal = NODE_BASELINE_MIB + oldV8 + 4 * 64;
    expect(oldTotal).toBeGreaterThan(512);

    // The replacement fits where that did not.
    const now = memoryBudget({ mem: "512Mi" } as never);
    expect(NODE_BASELINE_MIB + now.v8MiB + now.vmMiB * now.maxConcurrentForks).toBeLessThanOrEqual(512);
  });
});
