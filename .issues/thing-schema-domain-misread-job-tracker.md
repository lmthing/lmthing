# A branding studio's client work was modelled as a JOB-APPLICATION tracker (stock-template bleed)

**Symptom** (scenarios/20-studio run 1 step 1, 2026-07-31): asked to help a four-person **branding
studio in Porto** keep track of three live client projects, THING built a table for **job hunting** —
and then bolted the studio's real fields onto the same row.

`scenarios/20-studio/runs/1/data/.lmthing/fold-studio-jobs/database/jobs.json`:

> title: `Jobs`
> description: *"Holds **job application** records — the single table backing the jobs-detail/GET and
> jobs-update/PATCH endpoints. Each row is one job the user is tracking, with fields for **the role,
> company, application status, compensation range, contacts**, notes, and timestamps."*

| column | evidence of the misread |
|---|---|
| `status` | enum `saved · applied · interviewing · offered · accepted · rejected · withdrawn` |
| `title` | *"Job title / role name (e.g. 'Senior Frontend Engineer')"* |
| `company`, `location`, `url` | the job posting, the company, the listing URL |
| `salary_min`, `salary_max`, `salary_currency` | *"Minimum stated annual salary…"* |
| `contact_name`, `contact_email` | *"recruiter, hiring manager"* |
| `applied_at` | *"Date the application was submitted"* |
| `client`, `owner`, `name`, `last_updated`, `notes` | the studio's actual fields, on the same row |

The result is an incoherent hybrid: one table that is both a job-hunt tracker and a client-work
tracker, whose `status` domain cannot express any state the studio described.

## What the user actually said

Nothing in the opener is ambiguous about the domain. Ana names three client projects by name
(*Almeida*, *Trindade Bakery*, *the Serralves catalogue*), and describes their states in the
vocabulary of a studio: *"sitting waiting on the client"*, *"supposed to go to print this week"*.
The scenario's own `knows:` block records the intended domain — *"a press check either passes, or
comes back for a reprint"*, *"the studio bills by the job, not by the hour"*.

The word doing the damage is almost certainly **"jobs"**. Read as employment rather than as
commissioned work, it selects a stock schema, and the model then patched the user's real fields on
top rather than abandoning the template.

## Relationship to the restraint failure — probably one bug, NOT yet proven

This build only happened because THING authored on the OFFER turn instead of stopping to ask
(`.issues/thing-builds-on-the-offer-turn.md`). Because it never offered, it never received the
answer the scenario is written to give at step 2 — *"It's either with us, with the client, at the
printer, or done"* (`20-studio/scenario.yaml`, step 2 `if_asked."what states"`), which states the
domain outright. **The hypothesis is that the restraint failure caused the domain failure**: a
build with no clarification fell back to a template.

That hypothesis is **not tested**, and this file does not assert it. The honest position:

- the domain misread has been observed **once (n = 1)** — on the one turn that built unasked;
- 13 further replays of the same opener (5 personal, 6 minimal-team, 2 full-cast) authored nothing
  at all, so they produced no schema to judge, and therefore say nothing either way about the
  domain;
- the misread has **never been observed on a properly-accepted build**, because none has been
  played to completion since.

**The experiment that would separate them** is cheap and has not been run: play 20-studio steps 1–2
to completion (so the offer is made, the acceptance and its `if_asked` answers land, and only then
the build happens) and read `database/*.json`. If the schema is still a job-application tracker, the
domain misread is INDEPENDENT and this stays its own issue. If it is a studio job board, the two are
one bug and this file should be folded into the restraint issue.

```bash
cd sdk/org && node scenarios/run-team-scenario.mjs 20-studio --through 2
# then read runs/<n>/data/.lmthing/*/database/*.json
```

## Verify a fix

For the 20-studio opener, the table backing the studio's work must have a `status` domain drawn from
what the user said (with us / with the client / at the printer / done — or whatever they answer when
asked), and must not carry `salary_*`, `applied_at`, `company`, or a `title` documented as a role
name. A schema that mixes both vocabularies in one table is a failure even if the studio's fields
are present.
