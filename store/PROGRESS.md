# Store Apps — Modernization Progress

3-phase Opus fan-out across 5 apps: **ideate → implement → test/fix (live LLM)**, then commit/push/deploy.
Apps: **blog, health, kitchen, trips, homes**. Each app's proposals live in `store/projects/<app>/IDEAS.md`.

## Status

| App | P1 Ideate | P2 Implement | P3 Test/Fix | R2 spawn+apiCall |
|---|---|---|---|---|
| blog | ✅ done | ✅ done | ✅ done | 🔵 running |
| health | ✅ done | ✅ done | ✅ done | 🔵 running |
| kitchen | ✅ done | ✅ done | ✅ done | 🔵 running |
| trips | ✅ done | ✅ done | ✅ done | 🔵 running |
| homes | ✅ done | ✅ done | ✅ done | 🔵 running |

**Round 2** (2026-07-08): the SDK gaps are fixed (sdk/org 65ad314 / parent a4aab055) — `ctx.spawn` from an api handler now runs a real headless agent, and `apiCall` is injected into agent sessions. Each app is being updated to leverage these: the in-app concierge/assistant now acts **through validated endpoints via `apiCall`** (capability-model intent) instead of the db-first workaround, and adopts real `ctx.spawn` where cleaner (keeping the robust insert-hooks). Live-tested on the rebuilt local CLI dist.

## Log

- **Phase 1 (ideate)** started — 5 agents writing `IDEAS.md`.
- ✅ blog / health / trips IDEAS.md done → committed.
- ✅ kitchen IDEAS.md done → committed.
- ✅ homes IDEAS.md done (+ homes app now tracked) → committed. **Phase 1 complete.**
- **Phase 2 (implement)** started — 5 agents implementing each app's IDEAS.
  - (session limit hit mid-phase; all 5 agents resumed in place.)
- ✅ blog implemented → committed. New IA/left-rail+mobile nav, editorial cards, reading+research surface, Editor concierge agent+chat, RSS/OPML/Resend integrations; 22 tests pass.
- ✅ homes implemented → committed. Global alerts bell, command-center dashboard, triage cockpit, listing detail+map, concierge agent+dock, Nominatim/ICS/FX integrations; 36 tests pass.
- ✅ health implemented → committed. 6-section nav + mobile bar, dashboard rebuild, NL quick-log, Explain-Plainly, weekly digest, care/assistant agent+dock, wearables/OCR/notify scaffolds; 20 tests pass, clinical-safety preserved.
- ✅ trips implemented → committed. Overview dashboard + 3-group nav, time-gutter timeline w/ gap/conflict detection, agent_runs+RunStrip, settlement redesign, schematic map, copilot/assistant agent+dock, FX/weather/geocode/ics integrations; 44 tests pass.
- ✅ kitchen implemented → committed. Cook/Recipes/Shop/Insights IA + mobile bar, This-Week hero + coverage ribbon, paste-import, improvise flow, cooking mode, chef/concierge agent+dock, USDA/ICS/order scaffolds; 18 tests pass. **Phase 2 complete — all 5 apps.**
- ✅ manifest.json regenerated (6 apps) → committed.
- **Phase 3 (test/fix + live LLM)** started — 5 agents on isolated local pods (ports 8091-8095), live-testing LLM flows with sdk/org/.env creds.
  - NOTE: local CLI `spawnRunner` is a Phase-6 placeholder → spawn-backed app flows create a pending row but don't complete locally; the `<Chat>`/session agent path is the reliable live-LLM proof.
- ✅ kitchen tested/fixed → committed. Build clean, 18/18 tests; live-LLM verified (chef/concierge + nutritionist real output); fixed `&apos;` literal in CoverageRibbon.
- ⚠️ CROSS-CUTTING BUG (found by blog): `ctx.spawn()` from an app-API handler is a permanent no-op in the pod runtime. Correct pattern to run an agent from a user action = a `database:insert` hook (like `briefings`). Affects any AI feature wired via `ctx.spawn` (likely trips createTrip, homes scout).
- ✅ blog tested/fixed → committed. Build clean, 24/24 tests; live-LLM verified (explainer tldr + why-me, personalizer, real Azure output); added `generate-take` + `deep-research` insert-hooks, removed dead `ctx.spawn`.
- ✅ health tested/fixed → committed. Build clean, 20/20 tests; 4 live-LLM flows verified (logger draft, triage-nurse, weekly interpreter, care/assistant Chat). Fixed: sync-wearables cron→database hook (was aborting ALL db-hook wiring), bare `api:call` on assistant (broke `care` space load), missing `adherence_logs` read grant.
- ✅ homes tested/fixed → committed. Build clean, 41 tests (+5); 8 live-LLM flows verified (clipper/surveyor/analyst/locator/ranker/digest/concierge Chat). Fixed: locator missing `location_guesses` read grant (wrote 0 geocodes), pollSource ctx.spawn→`poll-source-now` db hook (NEW FILE), clipper action-dispatch, listing-title + phantom-listing parse quality. NOTE: new `sources.pollRequestedAt` column → existing prod pods need a migration on reinstall.
- ✅ trips tested/fixed → committed. Build clean, 46 tests (+2); live-LLM verified (createTrip→15 real itinerary items, treasurer splits, copilot Chat). Fixed: ctx.spawn→`dispatch-agent-run` db hook (NEW FILE), several `delegate()` signature bugs (empty itineraries), FX provider exchangerate.host→open.er-api.com + cache direction, copilot apiCall workaround. **Phase 3 complete — all 5 apps.**
- Platform gaps noted (SDK-level, worked around in-app, out of store/ scope): `ctx.spawn` app-API stub; `apiCall` global not injected into agent sessions.
- ✅ final manifest regen (registers generate-take/deep-research/poll-source-now/dispatch-agent-run) → committed & pushed.
- **Phase 4 (deploy):** token gate clean (576 files, 0 violations). CI built `store:1750780`; the automated ArgoCD tag-bump lost a rebase race on the image line, so it was pinned manually. ArgoCD synced → `store` deployment now runs `store:1750780` (pod Running). **Live-verified**: https://lmthing.store/projects/manifest.json serves all 6 apps incl. homes + all 4 new hooks. **DONE.**

## Result

All 5 apps (blog, health, kitchen, trips, homes) went through ideate → implement → live test/fix and are shipped to the prod store. Every app: builds clean, app tests pass, in-app agent chat + modern UX + LLM features + integrations added, and LLM flows live-verified against a real credentialed pod.

Cross-cutting SDK gaps found & worked around in-app (flagged for a platform fix): `ctx.spawn()` from app-API handlers is a no-op (use `database:insert` hooks); `apiCall` global isn't injected into agent sessions. Prod pods that already have these apps installed need a reinstall to pick up the new files/columns (e.g. homes `sources.pollRequestedAt`).
