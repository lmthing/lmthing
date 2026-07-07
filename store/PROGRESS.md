# Store Apps — Modernization Progress

3-phase Opus fan-out across 5 apps: **ideate → implement → test/fix (live LLM)**, then commit/push/deploy.
Apps: **blog, health, kitchen, trips, homes**. Each app's proposals live in `store/projects/<app>/IDEAS.md`.

## Status

| App | P1 Ideate | P2 Implement | P3 Test/Fix |
|---|---|---|---|
| blog | ✅ done | ✅ done | 🔵 running |
| health | ✅ done | ✅ done | 🔵 running |
| kitchen | ✅ done | ✅ done | 🔵 running |
| trips | ✅ done | ✅ done | 🔵 running |
| homes | ✅ done | ✅ done | 🔵 running |

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
