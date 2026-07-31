# zerostack works locally but has never run inside a pod

`system-zerostack` — the external Rust coding agent the engineer escalates to — is verified
end-to-end **on a dev machine**: the real binary, the real model, the real loopback bridge, and a
real `system-engineer/engineer` → `system-zerostack/zerostack` delegation. It has **never run inside
a built compute image**, so the one part that is pure assumption is the part that ships it.

Design + rationale: [`org/docs/system-spaces/zerostack.md`](../org/docs/system-spaces/zerostack.md).
Build log: [`design/zerostack-space-progress.md`](../design/zerostack-space-progress.md).

## Already verified — do not redo this

Local, against `zerostack 1.7.2` and `lmthingcloud:DeepSeek-V4-Pro` through
`sdk/org/libs/cli/src/host/zerostack-endpoint.ts`:

- A fresh data root with a deliberately broken project → the engineer escalated, and zerostack
  named all three seeded faults (a schema column with no `description`; a handler named `list.ts`
  rather than `<METHOD>.ts`; a missing `await` on the async `ctx.db`), each with evidence it
  gathered itself, citing `ARCHITECTURE.md` for the rule.
- Session resume (`sessionId` → `-c`) genuinely continues the same conversation.
- The primers are materialized on the **first turn**, not at boot; `status` stays a pure read.
- MCP is silent (upstream ships Exa/Context7/grep.app **on**; the generated config disables them).
- 30 bridge tests + 4 delegation-gate tests green; `pnpm docs:check` clean.

## Not verified — this is the issue

**1. The image build itself.** `devops/argocd/compute/Dockerfile` downloads a pinned release and
runs `zerostack --version` as a build step. That step has never executed in CI. It can fail on:

- the release asset name or URL changing upstream;
- `TARGETARCH` — the mapping handles `amd64`/`aarch64`, but only `amd64` has ever been exercised;
- a glibc mismatch — the `-gnu` build is chosen because the base is `node:24-slim` (Debian), which
  is right in principle and untested in practice.

The build gate is deliberate: a broken binary should fail the **build**, not surface inside a pod
the first time somebody asks for the one feature that needs it. But a build gate nobody has run is
also the most likely thing to break the compute image, so land it somewhere it can be watched.

**2. Anything about the pod that differs from a laptop.** Specifically:

- **Memory.** zerostack idles ~16 MB and peaks ~24 MB, on top of `MAX_SESSIONS` concurrent QuickJS
  VMs. Free-tier pods are Burstable with a real ceiling; nothing has measured the two together.
- **Cold wake / scale-to-zero.** `.zerostack/` lives on the pod volume so sessions should survive a
  wake — untested. The boot path is deliberately kept cheap
  (cold wake was tuned down to ~1s); confirm the lazy `ensureWorkspace` really does keep zerostack
  off it, since it is only reachable from a turn.
- **`/data` permissions and the `yolo` + `external_directory` confinement** behaving the same as on
  a dev box.
- **Spend.** Every call is a full coding agent for minutes against the user's LiteLLM budget. No
  one has watched what a real escalation costs.

**3. A turn longer than the pod tolerates.** The bridge long-polls in 15s slices because the
sandbox `fetch` aborts at 25s. In-pod there is also Envoy in front; a long-running `wait` has never
been through it. (It is loopback, so it should never touch Envoy — worth confirming, not assuming.)

## How to verify

1. Build the compute image and confirm the `zerostack --version` step passes for `amd64`.
2. Deploy, open a pod, and check `zerostackStatus()` reports `installed: true` with the pod's own
   model — not "not installed" and not an unusable-provider error.
3. Confirm the data root has **no** `AGENTS.md` / `ARCHITECTURE.md` / `.zerostack` until a turn runs.
4. Ask THING something that routes to the engineer and needs the live filesystem — e.g. break a
   generated app's schema and ask why it stopped working. Expect the fault named, with evidence.
5. Watch pod memory during the turn, and the user's budget after it.
6. Scale the pod to zero, wake it, and resume the same `sessionId`.

## Traps worth knowing before you start

- **`azure:` models are refused on purpose.** `mapProvider` only maps OpenAI-compatible providers;
  Azure needs an `api-version` query parameter a `base_url` cannot express. Production runs
  `lmthingcloud:` so this should not bite — but if `LM_MODEL_*` is ever an `azure:` spec, zerostack
  reports "no usable model" rather than silently billing zerostack's own OpenRouter default.
- **A project whose schema fails validation cannot host the session that would fix it** —
  `_initProjectSession` throws before the agent starts. Escalate from a healthy project; zerostack
  reaches any project on disk regardless.
- **Do not point it at `system/spaces/`** — re-materialized from the image on every boot, so a fix
  there reports success and is gone after the next restart.
