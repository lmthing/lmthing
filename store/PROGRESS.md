# Store Apps — Modernization Progress

3-phase Opus fan-out across 5 apps: **ideate → implement → test/fix (live LLM)**, then commit/push/deploy.
Apps: **blog, health, kitchen, trips, homes**. Each app's proposals live in `store/projects/<app>/IDEAS.md`.

## Status

| App | P1 Ideate | P2 Implement | P3 Test/Fix |
|---|---|---|---|
| blog | ✅ done | ✅ done | ✅ done |
| health | ✅ done | ✅ done | ✅ done |
| kitchen | ✅ done | ✅ done | ✅ done |
| trips | ✅ done | ✅ done | 🔵 running |
| homes | ✅ done | ✅ done | ✅ done |

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
- ✅ homes tested/fixed → committed. Build clean, 41 tests (+5); 8 live-LLM flows verified (clipper/surveyor/analyst/locator/ranker/digest/concierge Chat). Fixed: locator missing `location_guesses` read grant (wrote 0 geocodes), pollSource ctx.spawn→`poll-source-now` db hook (NEW FILE), clipper action-dispatch, listing-title + phantom-listing parse quality. NOTE: new `sources.pollRequestedAt` column → existing prod pods need a migration on reinstall. Still running: trips.
