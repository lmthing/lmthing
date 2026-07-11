# Events-everywhere rollout — PROGRESS

Single source of truth for this change set. Plan: `~/.claude/plans/what-would-it-take-sunny-moth.md`
(approved 2026-07-11). Previous effort (Serverless Free-Tier Pods, shipped 2026-07-07) archived in
git history of this file.
Policy: commit to **main** on every step (user-authorized); **NO back-compat** (no real users) —
green suite is the only gate. Execution: one opus subagent per step, waves per dependency graph.

| Step | Scope | Status | Commit |
|---|---|---|---|
| S1 | core: emitter def types + validation (+ verify-spec lift to core) | **done** (21 tests) | sdk/org 067fa52 |
| S2 | core: code nodes in space tasklists | **done** (14 tests) | sdk/org 0ce89ad |
| S3 | core: project functions scope | **done** (11 tests) | sdk/org b79919a |
| S4 | cli: emitter scan + containment | **done** (9 tests) | sdk/org a7b6713 |
| S5 | cli: webhook-emitter dispatch + manifest | **done** (11 tests; cli 601 green) | sdk/org 7b61023 |
| S6 | cli: cron emitters + db-hook REPLACEMENT (unified pipeline) | **done** (cli 645; ws typecheck 8/8) | sdk/org 8df7dda |
| S7 | cli: event hook type, hooks-in-spaces, ctx upgrade | **done** (full suite 590) | sdk/org cc64f12 |
| S8 | cli: internal signal seam | **done** (7 tests; cli 615 green) | sdk/org 5b61f20 |
| S9 | cli: headless tasklist runner + republish-on-write | **done** (7 tests; cli 608 green) | sdk/org dbadd7a |
| S10 | core+cli: generic function consent, store globals, emitEvent | **done** (core 752 green) | sdk/org 125ef5e |
| S11 | core: system-store space + THING/automator/engineer + live authoring | **done** (core 755; ws 8/8) | sdk/org a2c67a6 |
| S12 | store: integration-lmthing + catalog enrichment | **done** (6 tests; manifest 13 spaces) | sdk/org 7bd1651 · parent dcad27ab |
| S13 | ui: chat Integrations tab + auto-resume + status | **done** (30 new tests; lint:tokens clean) | sdk/org 573f47a |
| S14 | live verification on prod | IN PROGRESS — new compute image boots clean (no crash); event chain fires (signal→sink→emitter matched); FOUND+FIXED prod bug: worker-load-entry.js not a tsup entry → emit build 404 (e814088/f4091820); re-verifying on rebuilt image. Budget: test user over $10/1d (agent turns 429) | |
| S15 | migration fan-out: 10 integration spaces + 6 store projects | waits S14 | |
| S16 | docs, skills, studio format support | waits S15 | |

## S14 verification plan (the exact user scenario, keyless via integration-lmthing)
1. Test-user pod (379847043318834826) → mint gateway JWT → chat on lmthing.chat, ensure pod on new compute image.
2. Ask THING: "when a space is installed in this project, post a summary into the chat."
3. Expect: THING → delegate('system-store','finder',{query}) → recommends integration-lmthing
   (fit from enriched catalog events) → consent card → approve → installSpace → live-registered.
4. THING → automator writes hooks/<slug>.ts {type:'event', on:{event:'integration-lmthing/space.installed'},
   handler} into the LIVE project → republish.
5. Install a SECOND space (any) → space.installed signal → integration-lmthing emitter → typed event →
   project event hook fires → summary posted to chat. Verify end-to-end.
6. Regression smoke: a store app's cron/webhook still works; consent card renders (S13/S16 UI — card
   may be raw ask_start until S16 renderer, acceptable).
Deploy prereqs: compute:<newtag> rolled onto the test pod; store:<newtag> rebuilt (integration-lmthing
in catalog). ArgoCD hard-refresh. Watch: consent card needs a renderHost.ask UI — if chat can't render
the ConsentCard descriptor, S16 adds it; for S14, verify the yield/approve round-trips even if plain.

## Log
- 2026-07-11: plan approved (after 6 design rounds). Wave 1 launched: S1, S2, S3 (opus, parallel).
- 2026-07-11: user directives mid-flight: commit to main every step; drop all back-compat.
- 2026-07-11: S1 green+committed (sdk/org 067fa52; barrel hunk-split from parallel S2). S4+S7 launched.
- 2026-07-11: S2 green (14 tests; CodeNodeCtxFactory seam for S9; static TS extraction — core never
  executes node modules). Commit deferred until S3 lands (shared load.ts hunks to split).
- 2026-07-11: S3 green (project fns via DTS overlay; space-wins shadowing; per-project cache).
  S2→0ce89ad, S3→b79919a committed. S13 launched. Note: S1's commit accidentally carried S3's three
  barrel lines (hunk adjacency) — 067fa52 alone doesn't build; tip is green. S9 waits for S7 (both
  touch routes/hooks.ts + needs the ctx.tasklist seam).
- 2026-07-11: S4→a7b6713 (worker-isolated def extraction via new generic LoadModuleJob). S7→cc64f12
  (event hooks, space hooks worker-run, ctx upgrade w/ DelegateResult). S5+S9 launched.
- 2026-07-11: S13→573f47a (chat Integrations tab + auto-resume via __LM_SEND__ after pod-ready+socket-open;
  integrationStatus global; missingRequired on the integrations route).
- 2026-07-11: S5→7b61023, S9→dbadd7a, S8→5b61f20 committed+pushed. S8 & S10 hit the session limit
  mid-exploration; resumed from transcript after reset, both completed. S10→125ef5e (consent+store
  globals+emitEvent). S10 & S6 ran concurrently on disjoint file sets; committed S10's exact 27 files,
  left S6's app/hooks WIP unstaged. S6 (cron/db emitters + db-hook replacement) still running.
- KEY global signatures for S11 (from S10): storeSearch(q?)/storeInspect(id) [store:read],
  installSpace(id) [store:install, consent-marked] -> {ok,spaceKey,agentSlug,diverged?},
  emitEvent(name,payload) [events:emit]. Consent = @consent pragma on space fns / CONSENT_MARKED set
  for globals; fails closed headless.
- 2026-07-11: S6→8df7dda (unified pipeline; {type:'database'} DELETED). S15 db-hook rewrite pattern:
  `{type:'database', on:{table,event}, handler}` → `{type:'event', on:{event:'project/db.<table>.<insert|update|remove>'}, handler}`
  where ctx.input IS the row; delegate now returns the result.
- 2026-07-11: S11→a2c67a6. system-store agent slug = `finder`, delegate as
  delegate('system-store','finder',{query}). THING path 7 = discover→consent install→setup→automate.
  Project authoring globals writeProjectHook/Event/Function (hooks:write). S12 running (owns
  store-spaces.ts CatalogSpace + store/). Build phase nearly done → then S14 prod verify.
