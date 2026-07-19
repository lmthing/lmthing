# model-surface secrets hygiene: process.env declared to the model; keys surface in evidence

Two related exposures found while diagnosing the research-store bypass (2026-07-19):

1. **`declare const process: { env: Record<string, string|undefined> … }` sits in `COMMON_DTS`**
   (`sdk/org/libs/core/src/typecheck/library-dts.ts` — right below the old fetch line), i.e. the
   MODEL surface typechecks `process.env.X` in every context. Function bodies legitimately need it
   (webSearch reads TAVILY_API_KEY) — but model-authored code should not: combined with (formerly)
   ambient fetch, this is how a specialist hand-rolled a keyed Tavily POST. Raw `fetch` is now
   injected-only/undeclared (b7838c0); `process` deserves the same treatment — keep the runtime
   shim for function bodies, move the declaration out of the model-facing ambient DTS into the
   internal-only bundles (NET_FETCH_DTS pattern).

2. **Secrets in step evidence:** 06 run 26 step-05 evidence contains the literal Tavily API key
   inside a recorded fetch-yield's args. The scenario evidence writer (`scenarios/lib/evidence.mjs`
   `compact`/`summarizeTurn`) and/or the trace layer should redact known secret shapes
   (env values matching configured key names; `api_key`-style body fields) before persisting.

Neither blocks the campaign; both are cheap and mechanical. Do (1) with the same
declaration-contract test evolution as the fetch change; (2) with a golden evidence test.
