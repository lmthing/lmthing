# PROGRESS — scenario-campaign · task `05-latam` · round 2

_Started 2026-07-14T07:31:58.522Z. The agent MUST update this file at every step._

## Steps

<!-- append one bullet per step: what you did -->

## Files added to context

<!-- append every file you had to read / add to your context, with why -->
- **Oriented.** Read `scenario.md` (13 Acts, §6 table + Round-1 Actual results), `run.mjs` (1146 lines, Acts I–XIII implemented 1:1), `results/checkpoint.json` + `results/report.md`. **Frontier:** round 1 ended **FAIL on Act I** (THING did not OFFER; restraint regressed — it scaffolded 6 tables via the automator on a vague opener). Acts II–XIII are implemented but **have never been run live**.
- Checked THING's brain on HEAD: `user-thing/agents/thing/instruct.md` is now 37,107 b and *does* carry the OFFER + restraint rules (L293–314, commits 11a9396 → 73f50d5). Round 1's live image had 27,067 b (no offer rule at all) ⇒ the first question for round 2 is whether the deployed image finally carries it.
- Launched a read-only catalog-scout subagent to map current Act coverage vs the J–P coverage audit.

## Files added to context
- `sdk/org/scenarios/05-latam/scenario.md` — the spec being extended (Acts table + round-1 results)
- `sdk/org/scenarios/05-latam/run.mjs` — the runner being extended (helpers, hardening patterns, Act I/II/XIII bodies + main)
- `sdk/org/scenarios/05-latam/results/{report.md,checkpoint.json}` — what actually ran and passed
- `sdk/org/libs/core/system-spaces/user-thing/agents/thing/instruct.md` — THING's triage brain (the Act-I offer/restraint rules)

### Round 2 — local target
- **Local server** already up (shared, pid 326549, :8080); `smoke.mjs` PASS (9.1s turn, 1 llm call); `provision.mjs 05-latam` → `{pod:'http://localhost:8080', token:null}`.
- **Runner bug fixed (blocked every local run):** `run.mjs` called the gateway-only `mergePodEnv` (`PUT /api/compute/env`) unconditionally → `401 Missing or invalid Authorization header` on local (token is null). Now branches on `LOCAL`: locally it uses the pod's OWN live **`PUT /api/env`** (no roll), GET+merging so sibling lanes' keys in the shared pod-root `.env` survive. Bonus: that live-env route is itself an untested capability (audit group P).
- **Act I relaunched** against the local pod (HEAD source ⇒ the current `instruct.md`, 37,107 b, which DOES carry the OFFER + restraint rules at L293–314 — the prod image in round 1 had 27,067 b and no offer rule at all).

## Files added to context (round 2)
- `sdk/org/scenarios/harness/lib/{local,gateway,pod}.mjs` — the LOCAL flag, `provisionUser`'s local branch, the Pod API surface
- `sdk/org/libs/cli/src/server/routes/env.ts` — `PUT /api/env` shape (`{content}`, REPLACES the file → GET+merge)
- `sdk/org/libs/core/system-spaces/user-thing/agents/thing/instruct.md` (L280–330) — the offer/restraint/path-4 rules under test in Act I

### Act I — PASSES on local (the round-1 FAIL was a stale prod image)
- Act I green: offer appeared unprompted, **restraint held** (no authoring yield, **no build delegate**, `database/` empty before consent), bare "yes please" sufficed. Opener **69 s** (prod round 1: 890 s); authoring turn 585 s.
- ⇒ Round 1's FAIL was the deployed image (27,067 b instruct, no offer rule). HEAD source carries it and it works. The round-1 "restraint REGRESSED on HEAD (6 tables)" finding did **not** reproduce locally.

### New fixture — `camila-whatsapp-uyuni.png` (a text-bearing screenshot)
- The persona always promised "a screenshot a friend sent her" and the fixture set never had one. The only other image carries **no extractable text** (its token `2016-02-04` is in the *filename*), so nothing in 05-latam ever proved **pixels** were read.
- Token **`Red Planet Expedition`** — a REAL Uyuni operator (TripAdvisor d1940181). Gates passed: `strings` on the PNG does **not** contain it; `grep`/`pdftotext`/`unzip -p` across every other fixture: no match (disjoint); **vision round-trip verified** — gpt-5.4-mini read back *"book Red Planet Expedition … 1100 Bs per person, 3-day tour"* from pixels alone.

### Acts XIV–XVI written (scenario.md + run.mjs, 1:1)
- **XIV** (gap M) readDocument fails on an image → degrades to vision; pixels-only token must land in a real row.
- **XV** (gaps L+O) live `addColumn` migration: every pre-existing row id must survive; then force the **non-additive** half (retype a live column) and assert it **fails loud**, not silent data loss.
- **XVI** (gap P) **the loop guard**: "fill the cost in when i add a stop" compiles to a hook that watches the table it writes. Asserts the hook IS in that self-trigger shape, then that one insert fills the cost ONCE — bounded sessions (HOOK_DEPTH_CAP=3), no row explosion, pod alive.

### System-space prompt fix (mandatory improvement) — architect charter
- **Found live:** the architect's `fork:explore` nodes churn `Cannot find name 'glob' / 'grep' / 'listDir'` typecheck errors. Root cause: the architect does most work in **forks**, and a fork sees `charter.md`, **not** `instruct.md` (`context/system-block.ts`) — and the charter never said the generic fs is gone. THING and the automator have this guidance; the architect never got it.
- **Fix:** general principle in `charter.md` (no scenario specifics) naming the absent globals + why guessing costs a retry. Test `libs/core/src/spaces/fork-fs-guidance.test.ts` — verified it **fails** with the charter reverted, passes with it. Committed sdk/org `2a663f7`.

### Triage — the whole-session hard check was wrong in BOTH directions (assertion bug, fixed)
Act I's own 8 checks all passed, but the session invariant failed: *"3 turns ended in error"*.
- Those 3 were `turn_end.reason = 'stream_error'` in **delegate sub-sessions** (architect ×2, automator ×1) fired at the **same millisecond** — an LLM **provider transport** hiccup, not an eval/typecheck error. Each is immediately followed by a fresh `llm_request`: the runtime **retried and recovered**, and every deliverable landed (7 tables, app built). Counting them was a **false FAIL**.
- Worse, the check never looked at the retry budget, so it was **blind to the real thing it claimed to measure**: `attempt>=3` (MAX_RETRIES exhausted) — there were **4 genuinely unrecovered** errors it never saw, incl. `Cannot find name 'listDir'` — the exact bug the architect-charter fix targets.
- **Fixed (accurate + strictly stronger):** hard check is now `thing.unrecoveredErrors()` (the harness's own retry-budget measure, previously unused); `stream_error` becomes its own reported metric + note, never a scenario failure. Errors by attempt on the Act-I run: `{1:16, 2:8, 3:4}`.
- Rebuilt `@lmthing/core`, restarted the local server, **verified the new charter is live on the pod** (`.lmthing/system/spaces/system-architect/.../charter.md` contains the rule — adopted via `--adopt-system-spaces`).
