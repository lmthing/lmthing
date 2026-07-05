> ⚠️ **OUTSTANDING — operator directive (2026-07-04):** this app's round-1 project space was
> created with **only `agents/`**, which violates the space format. On the **next (expansion)
> round** you MUST remediate it to the **FULL space format**: add a `charter.md` per agent
> (alongside `instruct.md`), plus `tasklists/`, `functions/`, `components/`, and especially
> **extensive `knowledge/`** (each field = `index.md` overview + ≥2 `<aspect>.md` deep-dives).
> See `automation/app-builder/prompt.tmpl.md` → Phase 3 "Project-scoped spaces MUST follow the
> FULL space format" and the round policy's "SPACE-FORMAT REMEDIATION" item. This is required
> work, not optional.

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

---

# PLAN — round 2 (FEATURE EXPANSION)

Strictly additive on the round-1 app. Floors all exceeded: 2 new spaces (→3 total), 3 new agents,
8 new pages, 16 new endpoints (→28), 4 new hooks (→7), 8 new tables (→14). Plus full-format
remediation of `clinic`. Row types (singularizer): Document, DocumentExtraction, KnowledgeNote,
VisitBrief, Insight, Followup, Goal, Medication.

## database/ (8 new tables ✅ authored + validated by orchestrator; +2 columns on lab_results)
- `documents.json` — id(pk,uuid), kind(req), filename(req), mime(default text/plain), content(text,req),
  status(default pending), summary, error, uploadedAt(now). relations extractions(hasMany document_extractions via documentId), notes(hasMany knowledge_notes via documentId).
- `document_extractions.json` — id(pk), documentId(FK→documents cascade,req), targetTable(req), rowId(req),
  confidence(default 0.5), createdAt(now). relation document(belongsTo documents).
- `knowledge_notes.json` — id(pk), topic(req), body(req), sourceKind(default research), documentId?(FK→documents setNull), analyte?, tag?, createdAt(now). relation document(belongsTo).
- `visit_briefs.json` — id(pk), title(default), body(default ""), status(default pending), periodFrom?, periodTo?, createdAt(now).
- `insights.json` — id(pk), kind(req), body(req), metricKind?, createdAt(now).
- `followups.json` — id(pk), topic(req), reason?, dueAt(date,req), done(bool default false), labResultId?(FK→lab_results setNull), createdAt(now). relation lab(belongsTo).
- `goals.json` — id(pk), title(req), metricKind?, target?, current(default 0), status(default active), dueAt?, createdAt(now).
- `medications.json` — id(pk), name(req), dose?, schedule?, startedAt(date,req), endedAt?, note?.
- `lab_results.json` — +personalLow?, +personalHigh? columns; +followups relation (hasMany via labResultId).

## api/ (16 new endpoints — inline Db/Ctx types, async handler, HttpError from '@app/runtime')
- `documents/POST.ts` — uploadDocument {kind,filename,mime?,content} → {documentId,status}. Insert documents row status:'pending' (fires analyze-document). Reject empty content / oversize (>200k) with HttpError(400).
- `documents/GET.ts` — listDocuments {} → Document[] (uploadedAt desc).
- `documents/[id]/GET.ts` — getDocument {id} → Document & {extractions,notes}. include:['extractions','notes']; 404.
- `visit-brief/POST.ts` — prepareVisit {title?,since?} → {visitBriefId,status}. Insert pending visit_briefs (fires prepare-visit-brief).
- `visit-brief/GET.ts` — listVisitBriefs {} → VisitBrief[] (createdAt desc).
- `visit-brief/[id]/GET.ts` — getVisitBrief {id} → VisitBrief. 404.
- `insights/GET.ts` — listInsights {kind?} → Insight[] (createdAt desc, JS filter).
- `followups/GET.ts` — listFollowups {dueOnly?} → Followup[]. dueOnly → dueAt<=now && !done. sort dueAt asc.
- `followups/[id]/complete/POST.ts` — completeFollowup {id} → Followup. update done:true; 404.
- `goals/GET.ts` — listGoals {} → Goal[] (createdAt desc).
- `goals/POST.ts` — createGoal {title,metricKind?,target?,dueAt?} → Goal.
- `goals/[id]/PATCH.ts` — updateGoal {id,current?,status?,dueAt?} → Goal. 404.
- `metrics/import/POST.ts` — importMetrics {format,payload} → {imported}. Parse payload (csv text or array), bulk insert metrics, dedupe on kind+recordedAt (query-all + JS). format in apple|google|csv.
- `medications/GET.ts` — listMedications {} → Medication[] (startedAt desc).
- `medications/POST.ts` — addMedication {name,dose?,schedule?,startedAt,note?} → Medication.
- `knowledge/GET.ts` — listKnowledgeNotes {analyte?,tag?} → KnowledgeNote[] (createdAt desc, JS filter).

## hooks/ (4 new ✅ authored by orchestrator)
- `analyze-document.ts` — database documents:insert → trigger records/analyst#analyze.
- `prepare-visit-brief.ts` — database visit_briefs:insert → trigger clinic/interpreter#prep.
- `followup-reminders.ts` — cron daily 07:30 → trigger coaching/coach#reminders.
- `goal-checkin.ts` — cron daily 20:00 → trigger coaching/coach#checkin.

## spaces/ — full six-part format (agents{charter,instruct} + tasklists + functions + components + knowledge)
### records/ (NEW)
- agents/analyst — caps db:read [documents,document_extractions,lab_results,metrics,medications,knowledge_notes,settings], db:write [documents,document_extractions,lab_results,metrics,symptoms,medications,research]. functions:[parseCsv,detectKind]. components:[ExtractionSummary]. knowledge:[records/extraction]. defaultAction analyze. action analyze = model-driven (robust): self-query documents status:'pending'; for each, detectKind, parse content (parseCsv for csv), db.insert domain rows, db.insert document_extractions provenance, set documents.status analyzed/error+summary; for a novel/abnormal analyte insert pending research (fires research-deep-dive). NB: analyst holds no canDelegateTo — queues research via db insert.
- agents/librarian — caps db:read [knowledge_notes,sources,research,documents], db:write [knowledge_notes,sources]. knowledge:[records/knowledge-curation]. defaultAction curate. Curates notes from ready research + seeds trusted sources; dedupe by topic/value.
- functions/parseCsv.ts (CSV text → rows[]), detectKind.ts (guess kind from filename+content). 
- components/view/ExtractionSummary.tsx (card: N rows extracted, by table).
- knowledge/records/extraction/{index.md, lab-report-parsing.md, wearable-csv.md, provenance.md}; knowledge/records/knowledge-curation/{index.md, note-standards.md, dedupe.md}.
- tasklists/analyze/{index.md, 01-load-pending.md, 02-extract.md(forEach), 03-provenance.md} (documented decomposition).

### coaching/ (NEW)
- agents/coach — caps db:read [metrics,lab_results,symptoms,goals,followups,insights,settings], db:write [goals,followups,insights]. functions:[goalProgress,computeTrend]. components:[GoalProgress]. knowledge:[coaching/behavior-change, coaching/baselines]. defaultAction checkin. actions: checkin (per active goal compute current from metrics via goalProgress; set status met if target reached; else propose a followup), reminders (list due followups, display plain-language reminder). Chat surface on /goals.
- functions/goalProgress.ts (metrics+goal → current value), computeTrend.ts (series → pct change).
- components/view/GoalProgress.tsx (progress bar goal vs target — tokens only).
- knowledge/coaching/behavior-change/{index.md, goal-setting.md, follow-through.md}; knowledge/coaching/baselines/{index.md, trend-detection.md, correlations.md}.
- tasklists/checkin/{index.md, 01-load-goals.md, 02-evaluate.md(forEach), 03-followups.md}.

### clinic/ (REMEDIATE to full format — keep 3 agents; extend interpreter+logger caps/actions)
- interpreter: db:read += [visit_briefs,insights,followups]; db:write += [visit_briefs,insights]. New action `prep` (self-query pending visit_briefs; compile brief from flagged labs+active symptoms+trends+ready research + "Questions to ask"; status ready). `interpret` also caches personalLow/personalHigh (mean±2sd from analyte history) and proposes a followup on a newly-abnormal lab. `digest` now writes `insights` (trend/correlation rows) instead of display-only.
- logger: db:read/write += [medications]. Logs meds from chat.
- researcher: unchanged caps; gains knowledge/tasklists.
- functions/flagFromRange.ts, computeTrend.ts, personalBaseline.ts.
- components/view/TrendCard.tsx, FlagSummary.tsx.
- knowledge/clinical/reference-ranges/{index.md, common-panels.md, interpretation.md, not-a-doctor.md}; knowledge/clinical/triage/{index.md, red-flags.md, when-to-see-a-doctor.md}; knowledge/clinical/literature-research/{index.md, trusted-sources.md, citation-standards.md}.
- tasklists/digest/{index.md, 01-gather.md, 02-trends.md, 03-write-insights.md}; tasklists/prep/{index.md, 01-gather.md, 02-compose.md}.
- Wire knowledge:/functions:/components: into interpreter/researcher/logger instruct frontmatter.

## pages/ (8 new) + _layout nav update + components (10 new)
- documents/index.tsx, documents/[id].tsx, visits.tsx, insights.tsx, followups.tsx, goals.tsx, knowledge.tsx, medications.tsx.
- components: DocumentRow, UploadForm, ExtractionList, VisitBriefCard, InsightCard, FollowupRow, GoalCard, KnowledgeNoteCard, ImportForm, MedicationRow.
- _layout.tsx: add nav links Documents · Visits · Insights · Goals (+ keep Dashboard/Labs/Symptoms/Settings). Design tokens only.

## tests/health.test.mjs (extend)
- EXPECTED_TABLES → 14; endpoint list → 28; new hooks (4) shapes; new spaces exist w/ charter+instruct+functions+knowledge; full-format assertion (each space has knowledge/ with index.md); interpreter extended write scope; analyst/librarian/coach least-privilege (no authoring caps); records/coaching agents present.

## Build sequence (fan-out by directory to Sonnet subagents; orchestrator did database+hooks+schemas)
1. ✅ orchestrator: schemas (14), hooks (4), spec, plan.
2. Subagent A: 16 api handlers.
3. Subagent B: 8 pages + 10 components + _layout nav.
4. Subagent C: records space (full format).
5. Subagent D: coaching space (full format).
6. Subagent E: clinic remediation (functions/components/knowledge/tasklists + extend instruct).
7. orchestrator: extend test file; typecheck; lint:tokens; live pipeline; commit+push; prod install.

---

# ROUND 3 — feature expansion plan (active care management)

Theme: turn the passive tracker into an active care-management system — medication **adherence**,
literature-backed **interaction reviews**, **appointment**/care-team **coordination**, a shareable
**care-summary export**, and a conservative knowledge-grounded **symptom triage**. Strictly additive;
round-1/2 files untouched. Two new spaces → **five** total.

## database/ (orchestrator authors; 6 new tables + 2 cols + relations)
- adherence_logs.json — id(pk,uuid), medicationId(FK medications cascade,req), scheduledAt(date,req),
  takenAt(date), status(str def 'pending'), note(str). relation medication belongsTo medications.
- interactions.json — id, medicationId(FK medications cascade,req), otherName(str,req),
  severity(str def 'unknown'), body(str), status(str def 'pending'), createdAt(now). rel medication belongsTo.
- appointments.json — id, title(req), provider, location, kind(def 'doctor'), scheduledAt(date,req),
  status(def 'scheduled'), prepBriefId(FK visit_briefs setNull), note, createdAt(now). rel brief belongsTo visit_briefs.
- care_contacts.json — id, name(req), role(def 'other'), organization, phone, email, note, createdAt(now).
- care_shares.json — id, title, scope(def 'summary'), body(str), status(def 'pending'), token(str), createdAt(now).
- triage_assessments.json — id, symptomId(FK symptoms setNull), question(req), body(str),
  urgency(def 'unknown'), status(def 'pending'), createdAt(now). rel symptom belongsTo symptoms.
- medications.json (extend) — +refillsRemaining(number), +reminderTime(str HH:MM); +relations doses(hasMany
  adherence_logs via medicationId), interactions(hasMany interactions via medicationId).
- symptoms.json (extend) — +relation triage(hasMany triage_assessments via symptomId).
- visit_briefs.json (extend) — +relation appointments(hasMany appointments via prepBriefId).

## api/ (Subagent A — 16 handlers, mirror Ctx/Db inline-type shape of existing handlers)
doses/POST.ts logDose · doses/GET.ts listDoses · medications/[id]/GET.ts getMedication (include doses,interactions)
· interactions/POST.ts checkInteractions (402 gate on settings.tier; insert pending) · interactions/GET.ts listInteractions
· appointments/GET.ts listAppointments · appointments/POST.ts addAppointment · appointments/[id]/PATCH.ts updateAppointment
· contacts/GET.ts listContacts · contacts/POST.ts addContact · shares/POST.ts createShare (insert pending; token via crypto/randomUUID)
· shares/GET.ts listShares · shares/[id]/GET.ts getShare · triage/POST.ts requestTriage (FREE; insert pending)
· triage/GET.ts listTriage · triage/[id]/GET.ts getTriage.

## hooks/ (orchestrator — 5 new)
check-interactions.ts (database interactions:insert → pharmacy/pharmacist#review) ·
compile-care-share.ts (database care_shares:insert → care/coordinator#compile) ·
triage-symptom.ts (database triage_assessments:insert → care/triage-nurse#assess) ·
dose-reminders.ts (cron daily 09:00 → pharmacy/pharmacist#reminders) ·
appointment-reminders.ts (cron daily 07:00 → care/coordinator#reminders).

## spaces/pharmacy/ (Subagent C — full format)
- agents/pharmacist/{charter,instruct}.md — caps: db:read [medications,adherence_logs,interactions,research,
  knowledge_notes,sources,settings], db:write [adherence_logs,interactions]; OMIT functions (keep web + space fns).
  Actions: review (fill pending interactions via webSearch, cite, not-a-doctor), reminders (compute adherence via
  adherenceRate, surface missed/due doses; writes nothing).
- functions/adherenceRate.ts, functions/nextDoseDue.ts (typed, deterministic).
- components/view/AdherenceCard.tsx (token-gated chat card).
- knowledge/pharmacology/{adherence,interactions}/{index.md + >=2 aspects} — adherence: index, missed-dose-handling,
  adherence-metrics; interactions: index, common-interactions, literature-standards.
- tasklists/review/{index.md,01-load-pending.md,02-research.md,03-write.md}.

## spaces/care/ (Subagent D — full format, 2 agents)
- agents/coordinator/{charter,instruct}.md — caps: db:read [metrics,lab_results,symptoms,medications,adherence_logs,
  research,insights,followups,visit_briefs,appointments,care_contacts,care_shares,settings], db:write
  [care_shares,appointments,visit_briefs]; functions: [buildCareSummary] (deny web). Actions: compile (self-query
  pending care_shares, build md via buildCareSummary, mark ready), reminders (surface upcoming appts; for appt <48h
  w/o brief, insert pending visit_briefs + link via prepBriefId).
- agents/triage-nurse/{charter,instruct}.md — caps: db:read [symptoms,triage_assessments,metrics,lab_results,
  medications,knowledge_notes,settings], db:write [triage_assessments]; functions: [] (deny web+fns). Action: assess
  (self-query pending triage_assessments; reason over care/triage knowledge; write urgency+body; emergency banner).
- functions/buildCareSummary.ts (typed; assembles md sections from row arrays).
- components/view/{CareSummaryCard,TriageObservation}.tsx.
- knowledge/care/coordination/{index.md,share-scopes.md,appointment-prep.md} +
  knowledge/care/triage/{index.md,red-flags.md,when-to-escalate.md,urgency-levels.md}.
- tasklists/compile/{index.md,01-gather.md,02-compose.md} + tasklists/assess/{index.md,01-reason.md,02-write.md}.

## pages/ + components/ (Subagent B — 10 pages + 12 components + nav)
doses.tsx, medications/[id].tsx, interactions.tsx, appointments/index.tsx, appointments/[id].tsx, contacts.tsx,
shares/index.tsx, shares/[id].tsx, triage/index.tsx, triage/[id].tsx.
components: DoseRow, DoseChecklist, AdherenceBar, InteractionCard, SeverityBadge, AppointmentRow, AppointmentCard,
ContactCard, CareShareCard, TriageCard, UrgencyBadge, MedicationDetail.
_layout.tsx: add nav Doses · Appointments · Triage (+ keep existing). Design tokens only. import row types from @app/types.

## tests/health.test.mjs (orchestrator — extend)
EXPECTED_TABLES → 20; endpoint list → 44; EXPECTED_HOOKS → 12; SPACES adds pharmacy:[pharmacist], care:[coordinator,
triage-nurse]; full-format assertion covers all 5; new-agent least-privilege (no authoring caps); pharmacist/coordinator/
triage-nurse per-verb scope; checkInteractions 402 gate; getMedication include; medications new columns present.

## Build sequence (fan-out by directory)
1. orchestrator: schemas (6 new + 3 extend), hooks (5), spec, plan.
2. Subagent A: 16 api handlers.  3. Subagent B: 10 pages + 12 components + nav.
4. Subagent C: pharmacy space.   5. Subagent D: care space.
6. orchestrator: extend tests; build sdk/org core; typecheck; lint:tokens; live pipeline (temp LMTHING_ROOT, LM_MODEL=S);
   commit+push both repos; prod install + AI test.
