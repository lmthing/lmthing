# PROGRESS — scenario-campaign · task `06-tanzania` · round 2

_Started 2026-07-14T07:31:58.559Z. The agent MUST update this file at every step._

Round 2 = ADD ACTS (batch 2). Baseline: round 1 ended an **honest FAIL** (Acts I + XIII pass; II–XII,
XIV red), 9 product fixes landed AFTER that run (so most red Acts are unmeasured since), and one
high-severity open issue: **every served app renders blank**.

## Steps

- **Oriented.** Read `scenario.md` (Acts I–XIV + Actual results), `results/checkpoint.json`,
  `.issues/served-app-renders-blank-asset-404.md`. Ran a read-only catalog-scout subagent: all five
  fixture kinds already exist; never-covered catalog areas that fit this persona are **J** (dismissed
  `ask()` → null, ask security guards, space view/form components), **L** (`db.addColumn` live
  migration, capability gating AT TYPECHECK), **M** (scanned-PDF `readDocument` failure → vision
  fallback; history summarization), **P** (loop guard, payload validation, session-ledger).
- **Root-caused the blank-app bug** (read-only subagent, then confirmed in source): the clean-URL root
  mount `/:projectId/*` in `serve.ts` was registered **only** when `LMTHING_GATEWAY_URL` was set. On a
  pod whose `user-env` Secret predated that var, `/<project>/` matched no route, fell to the SPA
  catch-all and answered **200 with the pod's own shell** — whose bundle is root-absolute
  `/assets/index-*.js` → 404 under the app mount → blank page; and `/<project>/api/<route>` returned
  that same HTML instead of JSON. One cause, all three symptoms. The page builder was innocent.
- **Fixed it in the product.** The root mount is now **always registered** and **falls through** to the
  SPA when the first segment is not a project with a built app (new `fallback` arg on
  `createPageServeHandler`) or is in `RESERVED_ROOT_SEGMENTS`. Serving no longer depends on an env var
  that can go missing.
- **Test that would have caught it:** `libs/cli/src/server/serve-app-mounts.test.ts` — boots the REAL
  `startSessionServer` and asserts, on BOTH mounts, that the shell is the app's (rebased `<base href>`,
  no root-absolute `/assets/`) and the app's own api route answers **JSON**; plus that the always-on
  root mount does not shadow the SPA. **Verified it FAILS pre-fix** (it gets the pod SPA shell) and
  passes post-fix. Nothing tested the route table before — every unit test of the page handler passed
  the whole time the bug was shipping.
- Updated the 4 `org/docs` pages that documented the env gate; `pnpm docs:check` → 4537 citations
  resolve. Deleted the now-fixed `.issues/` entry. Rebuilt `@lmthing/cli`, restarted the local server.

- **Found the round's second product gap while building the new fixture:** a PDF with no text layer (a
  scan — every photographed receipt/permit) was a **DEAD END**. `extractDocumentText` returns nothing,
  `readDocument` says "unsupported", and because the file is routed as a *document* it carries no image
  part — so **no model in the system could ever look at it**. The agent could only give up or guess.
  **Fixed** (sdk/org `f4cb7ae`): a scan is a photograph wrapped in a PDF, so the page content IS an
  embedded image — `extractPdfPageImages` pulls the pages via unpdf and PNG-encodes them with
  `node:zlib` (no canvas, no native codec, **no new dependency**), saves them as real image uploads, and
  `readDocument` now NAMES those page ids. The ordinary image→vision path then just works. 3 new tests
  in `uploads.test.ts` (verified they fail without the fix). Also fixed a **pre-existing typecheck break
  on main** (`system.test.ts` referenced `Space.id`).
- **System-space prompts got smarter** (general principles, zero scenario strings): `system-files/reader`
  — relay the host's error verbatim instead of flattening it to "could not be read", and never guess a
  document's contents from its filename; `system-files/dispatch` — may now delegate to `system-vision`:
  a document with no text is a *picture* of a document, so look at it rather than report failure.
- **New fixture (round-2 requirement):** `zanzibar-museum-receipt.pdf` — a real public-domain Wikimedia
  photograph (Livingstone's handwritten 1872 chronometer receipt, taken at the Zanzibar Museum) wrapped
  unaltered into a text-layer-less PDF. 0 chars from `pdftotext` AND from the pod's own extractor.
  Tokens (`Unyanyembe`/`Livingstone`/`chronometer`) grep-verified absent from every other fixture.
- **Wrote the 3 new Acts** (sdk/org `5e01341`), 1:1 in `scenario.md` + `run.mjs`, each closing a
  never-covered gap: **XV** scan → vision → token in real state (gap M) · **XVI** an event hook that
  writes the table it listens to → the **loop guard** must settle (gap P) · **XVII** history
  summarization past `maxHistoryTurns`, the rule from before the boundary survives (gap M). Act XIV (the
  browser pass) still runs LAST so it sees the app the new Acts evolved.
- **Launched the full live run** (Acts I–XIII, XV–XVII, then XIV) against the local pod, `--fresh`
  (the local pod had no prior state — round 1 ran on prod).

- **Live run (local pod), findings.** Act I **PASSES** (THING offered unprompted, citing **5** of his
  own specifics, zero authoring before consent, all 5 attachments classified right). Then Acts II–XI
  fail from **ONE root cause**: after the bare "Yes please", the automator authored **2 tables (24 real
  seeded rows, matching his file)** and **stopped** — **0 pages, 0 api routes, 0 spaces** — in only
  **143s**. With no pages the app is `built:false` and serves **404**, so every downstream Act (the
  relation, `apiCall`, `@app/types`, the in-app chat) has nothing to stand on. And THING announced
  **"Yes, it's ready! 🎉 the app is live right now"** — a claim it never checked.
  - The missing **spaces** are why Act III's PDF-hotline and voice-memo tokens never reached real
    state: with no space knowledge files, the facts that do not belong in a row had nowhere to land.
    (`ZZJQUU` ✓ and the xlsx's computed `3344.2` ✓ **did** land in db rows, and the photo **did** go
    through vision — so ingest itself works.)
  - **The serve fix is LIVE-VERIFIED:** Act VIII's throwing route returned a proper
    `{"error":{"status":400,"message":"simulated failure"}}` **JSON** at the app's own clean URL. In
    round 1 (prod) that same probe got the HTML shell back. That is the blank-app bug, closed.
- **Fixed both prompt bugs as general principles** (sdk/org `2d145c2`), grep-verified to contain **zero**
  scenario/persona/fixture literals: (1) *before you tell them it is ready, CHECK that it is* — a
  project with tables and no page is data in a drawer, and announcing it as live is a lie they discover
  the moment they tap the link; (2) *they will not ask you for the parts they do not know exist* — when
  the material spans several durable topics, give each its own space alongside the app, so a later plain
  question has somewhere informed to go and the non-row facts are kept.

## Files added to context

- `sdk/org/scenarios/06-tanzania/scenario.md` — the spec + round-1 Actual results (which Acts exist/passed)
- `sdk/org/scenarios/06-tanzania/results/checkpoint.json` — per-Act resume state from round 1
- `.issues/served-app-renders-blank-asset-404.md` — the open high-severity bug (now fixed + deleted)
- `sdk/org/libs/cli/src/server/serve.ts` — the route table; where the env-gated root mount lived (the bug)
- `sdk/org/libs/cli/src/app/pages-serve.ts` — `createPageServeHandler`; added the `fallback` arg
- `sdk/org/libs/cli/src/server/router.ts` — to confirm match order + param semantics
- `sdk/org/libs/cli/src/server/routes/app-api.ts` — the app-api handler (404s when a project has no db)
- `sdk/org/libs/cli/src/server/serve-spaces.test.ts`, `libs/cli/src/app/build/pages.test.ts`,
  `libs/cli/src/app/api/loader.test.ts`, `libs/cli/src/app/boot.test.ts` — fixture shapes for the new test
- `org/docs/{README.md, app/routes.md, cli-api/README.md, format/project/project.json.md}` — the pages that
  documented the env gate
