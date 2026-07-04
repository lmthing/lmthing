# PLAN — `health` project-application (round 1, CORE BUILD)

File-by-file plan for `store/projects/health/`. Mirrors `store/projects/{blog,kitchen}/` shapes.
`types/` + `.data/` + `node_modules/` are git-ignored (generated/runtime).

## Root config
- `package.json` — `@lmthing/app-health`, deps: react, react-dom, `@lmthing/ui`, `@lmthing/css`.
- `tsconfig.json` — copy kitchen's verbatim (ES2022, react-jsx, strict, include pages/components/lib/api/hooks/types).
- `.gitignore` — `types/ .data/ node_modules/ dist/`.
- `README.md` — one-paragraph description + local-run note.

## database/ (6 tables — descriptions mandatory, exactly-one PK, FKs/relations resolve)
- `metrics.json` — id(pk,uuid), kind, value(number), unit, recordedAt(date), source(default manual), note.
- `lab_results.json` — id(pk), panel, analyte, value, unit, refLow?, refHigh?, flag(default normal),
  takenAt(date), note. relation `research: hasMany research via labResultId`.
- `symptoms.json` — id(pk), name, severity(default 1), startedAt(date), endedAt?, note.
  relation `research: hasMany research via symptomId`.
- `research.json` — id(pk), labResultId? (references lab_results.id onDelete cascade),
  symptomId? (references symptoms.id onDelete cascade), topic(req), body, status(default pending),
  createdAt(generated now). relations `lab: belongsTo lab_results via labResultId`,
  `symptom: belongsTo symptoms via symptomId`.
- `sources.json` — id(pk), kind, value(unique), label?, trust(default 0.5).
- `settings.json` — id(pk), tier(default free), weeklyBudgetUsd(default 1), acceptedDisclaimer(default false).

Row types: Metric, LabResult, Symptom, Research, Source, **Setting**.

## api/ (12 endpoints — inline Db/Ctx types, async handler, HttpError from '@app/runtime')
- `metrics/GET.ts` — `listMetrics` `{kind?, from?, to?}` → Metric[]. query-all + JS filter by kind + date range; sort by recordedAt.
- `metrics/POST.ts` — `logMetric` `{kind,value,unit,recordedAt?,source?,note?}` → Metric.
- `labs/GET.ts` — `listLabs` `{panel?}` → LabResult[]. query-all + JS filter; flagged (non-normal) first, then takenAt desc.
- `labs/POST.ts` — `addLab` `{panel,analyte,value,unit,refLow?,refHigh?,takenAt,note?}` → LabResult. Insert with flag:'normal' (interpreter re-flags via hook). NEVER set flag from user input.
- `labs/[id]/GET.ts` — `getLab` `{id}` → LabResult & {research: Research[]}. include:['research']; 404 if missing.
- `symptoms/GET.ts` — `listSymptoms` `{}` → Symptom[]. active (endedAt null) first, then startedAt desc.
- `symptoms/POST.ts` — `logSymptom` `{name,severity?,startedAt,note?}` → Symptom.
- `research/POST.ts` — `requestResearch` `{topic,labResultId?,symptomId?}` → {researchId,status}. Read settings[0]; if tier!=='subscription' → HttpError(402). Insert pending research (fires research-deep-dive hook).
- `research/[id]/GET.ts` — `getResearch` `{id}` → Research. 404 if missing.
- `settings/GET.ts` — `getSettings` `{}` → Setting. query-all; if none, insert {tier:'free',weeklyBudgetUsd:1,acceptedDisclaimer:false}; return [0].
- `settings/disclaimer/POST.ts` — `acceptDisclaimer` `{}` → Setting. find-or-create then update acceptedDisclaimer:true; return row.
- `stats/GET.ts` — `healthStats` `{}` → {metrics,labs,flagged,activeSymptoms,research}. counts across tables (flagged = labs where flag!=='normal'; activeSymptoms = symptoms where endedAt null).

## hooks/ (3)
- `interpret-new-lab.ts` — database, on lab_results insert, handler → `delegate('clinic/interpreter','interpret',{input:{labResultId:row.id}})`. budget maxEpisodes 8.
- `research-deep-dive.ts` — database, on research insert, handler → `delegate('clinic/researcher','deep-dive',{input:{researchId:row.id}})`. budget maxEpisodes 8, maxWallClockMs 300000.
- `daily-digest.ts` — cron, daily '08:00', trigger `clinic/interpreter#digest`. budget maxEpisodes 6, maxWallClockMs 300000.

## spaces/clinic/agents/ (3 agents — least-privilege, per-verb table scope; instruct.md + charter.md)
- `logger` — caps db:read/db:write [metrics, lab_results, symptoms]. Records measurements/results/symptoms from chat. Never sets flag (role, not cap). No actions needed beyond model-driven.
- `interpreter` — caps db:read [lab_results, metrics, symptoms, settings], db:write [lab_results, research].
  actions: `interpret` (read lab by id, compare value vs refLow/refHigh, set flag low/normal/high; if abnormal AND settings.tier==='subscription' insert pending research{labResultId,topic,status:'pending'}),
  `digest` (read recent flagged labs + active symptoms + metric trends, produce a plain-language morning summary via display; round-1 = no table write — insights table is round 2). defaultAction interpret.
- `researcher` — caps db:read [research, lab_results, symptoms, sources], db:write [research]. OMIT functions: (keeps universal webSearch/webFetch). action: `deep-dive` (read research by id + its lab/symptom context; web-search reputable medical sources; write body markdown with citations + not-a-doctor line; update status:'ready'). defaultAction deep-dive.
- All three: charter.md = short identity + not-medical-advice guardrail. NO db:schema/pages:write/api:write/hooks:write.

## pages/ (7 files) + components/
- `_app.tsx` — passthrough (kitchen shape).
- `_layout.tsx` — nav: Dashboard · Labs · Symptoms · Research(via labs) · Settings + standing Disclaimer banner.
- `index.tsx` — dashboard: HealthStats strip (healthStats) + MetricChart per kind (listMetrics) + quick logMetric form.
- `labs/index.tsx` — labs list (listLabs), FlagBadge, flagged first, link to detail.
- `labs/[id].tsx` — getLab: value vs ref range, FlagBadge, linked research list, requestResearch button (shows 402 message on free tier).
- `symptoms.tsx` — listSymptoms + logSymptom form; SymptomRow.
- `research/[id].tsx` — getResearch (poll until status ready) + MarkdownBody + `<Chat agent="clinic/researcher" />`.
- `settings.tsx` — getSettings: tier, weeklyBudget, disclaimer ack (acceptDisclaimer).
- components: `HealthStats.tsx`, `MetricChart.tsx` (SVG line, tokens: stroke via primary/accent), `FlagBadge.tsx` (success/warning/destructive), `LabRow.tsx`, `SymptomRow.tsx`, `MarkdownBody.tsx`, `Disclaimer.tsx`, `Spinner.tsx`.
- Design tokens ONLY. Flag: normal→success, low→warning, high→destructive.

## tests/health.test.mjs
- 6 schemas pass real `validateSchemaSet` (built @lmthing/core); descriptions+PK; research two-FK resolve.
- 12 endpoints exist w/ name/Input/Output/default async handler; requestResearch 402 gate; getLab include; getSettings find-or-create.
- 3 hooks shapes (2 database + 1 cron); interpret-new-lab delegates interpreter; research-deep-dive delegates researcher.
- clinic 3 agents least-privilege (no authoring caps); per-verb table scope (interpreter writes lab_results+research; logger writes metrics/lab_results/symptoms; researcher writes research).

## Verification (Phase 4)
- Structural test suite green (`node --test store/projects/health/tests/health.test.mjs`).
- Token lint green on health pages/components.
- Full pipeline under `lmthing serve` (temp LMTHING_ROOT, health materialized, LM_MODEL=S): manifest 6 tables + 12 endpoints + 3 hooks; types generated incl. `Setting`; pages build; GET /app/health/ → 200; api I/O live.
- 🔴 LIVE core loop (DeepSeek): seed settings tier='subscription'; addLab abnormal (LDL 190, refHigh 130) → interpret-new-lab hook → interpreter sets flag:'high' → inserts pending research → research-deep-dive hook → researcher fills body status:'ready'. Also free-tier: addLab → flag set, requestResearch → 402. Capability gate proven (agent denied out-of-scope table).
- Install to local test user root; re-run core loop as that user.
