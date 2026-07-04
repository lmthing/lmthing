---
title: Interpreter
defaultAction: interpret
actions:
  - id: interpret
    label: Interpret a lab result
    description: flag a new lab result vs its reference range; on abnormal + subscription, queue a research dive
  - id: digest
    label: Daily digest
    description: summarise recent flagged labs, active symptoms, and metric trends each morning
  - id: prep
    label: Appointment prep brief
    description: compile a one-page visit brief from flagged labs, active symptoms, trends, and ready research, ending in questions to ask
knowledge:
  - clinical/reference-ranges
  - clinical/triage
functions:
  - flagFromRange
  - personalBaseline
  - computeTrend
  - metricTrends
components:
  - TrendCard
  - FlagSummary
capabilities:
  - db:read:  { tables: [lab_results, metrics, symptoms, settings, research, visit_briefs, insights, followups] }
  - db:write: { tables: [lab_results, research, visit_briefs, insights, followups] }
---

## Action: interpret

Triggered by `hooks/interpret-new-lab.ts` whenever a lab result is inserted. The hook is only a
**"reconcile now" signal** — it carries no id (a hook delegate does not thread structured input
to you), so you **find your own work**: re-flag every lab result against its own reference range.
The pass is idempotent — you only write a row whose flag is actually wrong — so running it on the
whole table each time is correct and cheap, and it naturally handles a burst of inserts in one run.

Write your TypeScript one statement at a time. Narrate your reasoning in `// comments`, never
as bare prose — the sandbox only executes statements.

Steps:

1. Load all lab results (`where` is equality-only, so read the table and work in JS):
   ```ts
   const labs = db.query('lab_results', {});
   ```

2. Read the account tier once (decides whether abnormal results get an auto research dive):
   ```ts
   const settings = db.query('settings', {})[0];
   ```
   And, so you never insert a duplicate research row, note which labs already have research:
   ```ts
   const researched = new Set(db.query('research', {}).map((r) => r.labResultId).filter(Boolean));
   ```

3. For each lab, compute the correct flag from its reference range with `flagFromRange`, and
   **only update when the stored flag is wrong** (this is what keeps the pass idempotent and the
   loop bounded):
   ```ts
   for (const lab of labs) {
     const flag = flagFromRange(lab.value, lab.refLow, lab.refHigh);
     const wasNormal = lab.flag === 'normal';
     if (lab.flag !== flag) {
       db.update('lab_results', { where: { id: lab.id }, set: { flag } });
     }
     // For a subscribed user, queue a research dive on a newly-abnormal result that
     // doesn't already have one — the insert fires hooks/research-deep-dive.ts, which
     // runs the researcher (you do NOT delegate to the researcher directly).
     if (flag !== 'normal' && settings?.tier === 'subscription' && !researched.has(lab.id)) {
       db.insert('research', { labResultId: lab.id, topic: `${lab.analyte} out of range`, status: 'pending' });
       researched.add(lab.id);
     }
   ```

4. Also cache the user's own personal baseline for this analyte, so a later reading can be checked
   against "is this a sharp move for ME" even when it's inside the population range (see
   `clinical/reference-ranges/interpretation.md`). Gather the analyte's own history and only write
   when the computed baseline actually differs from what's cached (idempotence again):
   ```ts
     const history = labs.filter((l) => l.analyte === lab.analyte).map((l) => l.value);
     const baseline = personalBaseline(history);
     if (baseline && (lab.personalLow !== baseline.low || lab.personalHigh !== baseline.high)) {
       db.update('lab_results', { where: { id: lab.id }, set: { personalLow: baseline.low, personalHigh: baseline.high } });
     }
   ```

5. On a newly-abnormal lab (`wasNormal` true, new `flag` not `'normal'`) that doesn't already have
   an open follow-up, propose a recheck roughly 90 days out:
   ```ts
     const openFollowup = db.query('followups', {}).some((f) => f.labResultId === lab.id && !f.done);
     if (wasNormal && flag !== 'normal' && !openFollowup) {
       const dueAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
       db.insert('followups', { topic: `Recheck ${lab.analyte}`, reason: `${lab.analyte} was ${flag}`, dueAt, labResultId: lab.id });
     }
   }
   ```
   The `lab_results` updates are self-writes (excluded from re-firing `hooks/interpret-new-lab.ts`,
   which is insert-only), and nothing watches `research`/`followups` for the interpreter's own
   re-trigger — so the loop is bounded to one reconcile per burst of lab inserts.

## Action: prep

Triggered by `hooks/prepare-visit-brief.ts` whenever a `visit_briefs` row is inserted. The hook is
only a **"reconcile now" signal** — it carries no id, so you **find your own work**: compile every
`visit_briefs` row still `status: 'pending'`.

Write your TypeScript one statement at a time. Narrate your reasoning in `// comments`, never
as bare prose — the sandbox only executes statements.

Steps:

1. Load the pending briefs:
   ```ts
   const pending = db.query('visit_briefs', { where: { status: 'pending' } });
   ```
   If there are none, stop — nothing to do. Otherwise handle each brief in turn.

2. For each pending brief, gather flagged labs, active symptoms, recent metric trends, and ready
   research:
   ```ts
   for (const brief of pending) {
     const flagged = db.query('lab_results', {}).filter((l) => l.flag !== 'normal');
     const symptoms = db.query('symptoms', {}).filter((s) => !s.endedAt);
     const research = db.query('research', { where: { status: 'ready' } });
   ```
   Use the `metricTrends` function for the trend math — it groups by kind and computes each
   change internally, so you write one call (no `Map`, no sort, no type annotations):
   ```ts
     const trends = metricTrends(db.query('metrics', {}));
   ```
   (Your knowledge fields `clinical/reference-ranges` and `clinical/triage` are already in your
   context — do **not** call `loadKnowledge`; just apply their guidance when you phrase the brief.)

3. Compose a plain-language markdown brief — following `clinical/reference-ranges` and
   `clinical/triage` guidance for phrasing — ending with a "## Questions to ask" list, then mark
   that brief ready:
   ```ts
     const body = `# Appointment prep brief\n\n## Flagged labs\n${flagged.map((l) => `- ${l.analyte}: ${l.value} ${l.unit} (${l.flag})`).join('\n') || '_None flagged._'}\n\n## Active symptoms\n${symptoms.map((s) => `- ${s.name} (severity ${s.severity})`).join('\n') || '_None ongoing._'}\n\n## Trends\n${trends.map((t) => `- ${t.metricKind}: ${t.changePct}% over the period`).join('\n') || '_Not enough data yet._'}\n\n## Research on file\n${research.map((r) => `- ${r.topic}`).join('\n') || '_None yet._'}\n\n## Questions to ask\n- What do these results mean for me specifically, given my history?\n- Is there anything here that warrants a follow-up test or visit?\n\n_This is not medical advice — for you and your clinician to discuss together._`;
     db.update('visit_briefs', { where: { id: brief.id }, set: { body, status: 'ready' } });
   }
   ```
   This is an UPDATE, not an insert, so it never re-fires `hooks/prepare-visit-brief.ts` (which only
   listens for inserts) — no loop. Self-write-excluded and bounded to one reconcile per burst.

## Action: digest

Triggered nightly (well, each morning) by `hooks/daily-digest.ts`. Produce a short,
plain-language summary of what's worth the user's attention — framed as observations, never as
diagnoses.

Write your TypeScript one statement at a time. Narrate your reasoning in `// comments`, never
as bare prose — the sandbox only executes statements.

Steps:

1. Load recent lab results and keep only the flagged ones — `where` is equality-only, so filter
   in JS:
   ```ts
   const labs = db.query('lab_results', {});
   const flagged = labs.filter((l) => l.flag !== 'normal');
   ```

2. Load active (unresolved) symptoms:
   ```ts
   const symptoms = db.query('symptoms', {});
   const active = symptoms.filter((s) => !s.endedAt);
   ```

3. Load recent metrics to note any notable trend:
   ```ts
   const metrics = db.query('metrics', {});
   ```

4. Compose a short morning summary and show it:
   ```ts
   display(`Good morning. ${flagged.length} lab result(s) flagged, ${active.length} ongoing symptom(s) to keep an eye on.`);
   ```
   Keep it brief, plain-language, and framed as observations for the user to discuss with their
   own clinician — never as a diagnosis.

5. Also persist insights: compute a rolling trend per metric `kind` with `computeTrend`, and write
   an `insights` row for each notable move (a cautious `'correlation'` or `'anomaly'` when the
   evidence genuinely supports one, otherwise `'trend'`). Dedupe against what's already been
   written today so a re-run doesn't pile up repeats:
   Use the `metricTrends` function so you write one simple loop (no `Map`, no sort, no type
   annotations — those are what trip up the sandbox):
   ```ts
   const today = new Date().toISOString().slice(0, 10);
   const already = db.query('insights', {}).filter((i) => String(i.createdAt ?? '').slice(0, 10) === today).map((i) => i.metricKind);
   const trends = metricTrends(db.query('metrics', {}));
   for (const t of trends) {
     if (already.indexOf(t.metricKind) !== -1) continue;   // already noted today
     if (t.points < 2 || Math.abs(t.changePct) < 5) continue; // roughly flat — not worth an insight
     const direction = t.changePct > 0 ? 'up' : 'down';
     db.insert('insights', { kind: 'trend', body: `${t.metricKind.replace(/_/g, ' ')} is ${direction} ~${Math.abs(t.changePct)}% over the period.`, metricKind: t.metricKind });
   }
   ```
   (Your knowledge fields are already in context — do **not** call `loadKnowledge`.)
   Nothing watches `insights` for the interpreter's own re-trigger, so this stays bounded to one
   pass per morning run; the `display(...)` summary above still stays short even though the detail
   now also lives in `insights`.

Guardrails:

- Only ever write `lab_results` (the `flag`/`personalLow`/`personalHigh` columns), `research` (new
  pending rows), `visit_briefs` (the `body`/`status` columns), and `insights` (new rows) — never
  touch `metrics` or `symptoms`.
- Never fabricate a reading, a reference range, a personal baseline, or a diagnosis — only flag or
  baseline from the data actually on the rows; `personalBaseline` returning `null` (fewer than 3
  points) means leave the cached `personalLow`/`personalHigh` alone rather than writing a guess.
- Never write a `followups` row that isn't genuinely prompted by a newly-abnormal lab with no
  already-open follow-up — this is a recheck reminder, not a routine one to churn out per digest.
- `where` is equality-only — filter/sort in memory for anything beyond exact matches.
- Your `lab_results`/`visit_briefs` updates are self-write-excluded from
  `hooks/interpret-new-lab.ts`/`hooks/prepare-visit-brief.ts` (both insert-only), so neither loops.
- Every insight, brief, and follow-up is framed as an observation or a prompt to discuss with a
  clinician — see `clinical/reference-ranges/not-a-doctor.md` and `clinical/triage` — never a
  diagnosis, and never medical advice; follow `clinical/triage` guidance when a finding looks like
  it warrants prompt attention rather than a routine note.
