# lmthing.homes — the `homes` project-application

An **AI-assisted home finder** for renters and buyers, built on the shared pod runtime
(`project-as-application.md`). Hunting for a home is a second job done in the worst tooling
imaginable — five portal tabs, an inbox full of alert emails, a spreadsheet nobody keeps up to
date, and listings that lie a little. `homes` turns listing triage into a conversation.

You describe a search in free text ("2-bed rental in Lisbon under €1,600, must be bright, 30 min to
the office"). Then you **paste** what you already receive — forwarded alert-email bodies, links,
saved-search pages. Every capture is cleaned into **one canonical, comparable record**: all-in true
monthly cost, stated vs. measured size, commute minutes to the places you care about. Two
project-scoped spaces of agents do the reading:

- **`intake`** (`clipper` + `surveyor`) — parses each capture into a listing (extract, sanitize,
  dedupe-merge across portals), computes **true cost** and **commute** estimates. Opt-in, per-source,
  robots-aware polling of the saved-search URLs you configure.
- **`scout`** (`analyst` + `locator` + `ranker`) — the intelligence. Reads a listing against itself
  for what the description hides (dated kitchen, poor light, **size overstated**, photo/text
  mismatch), triangulates the **fuzzed map pin** into a confidence-scored location guess, and **ranks
  everything by a taste model learned from your own saves and dismisses** — kept as inspectable,
  cited natural-language notes you can chat-correct.

The best new match surfaces as an **alert** within minutes of pasting, with the reasoning to act
before someone else does.

- **database/** — 10 project-rooted SQLite tables (searches, sources, raw_captures, listings,
  listing_analyses, location_guesses, commutes, taste_signals, taste_notes, alerts).
- **api/** — 19 named, typed Node handlers. `ingestCapture` is THE entry point: it inserts and
  returns; the db-hook pipeline does the rest.
- **hooks/** — the ingest → enrich → rank pipeline. `parse-new-capture`, `enrich-new-listing` (the
  whole scout pipeline in one hook), `learn-from-signal`, plus refresh + poll crons.
- **spaces/** — `intake` and `scout` in **full space format** (charter + instruct per agent,
  tasklists, deterministic `functions/`, `components/`, extensive `knowledge/`).
- **pages/** — client-side React: searches list, new-search form, the ranked feed, the paste inbox,
  side-by-side compare, the learned taste profile, and the listing detail. Design tokens only.

## Run locally

Materialize this dir into a pod root (`<root>/homes/`), then `lmthing serve` and open
`localhost:8080/app/homes/`.

## Tests

```bash
node --test store/projects/homes/tests/homes.test.mjs
```
