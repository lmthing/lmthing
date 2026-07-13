# `health` — lmthing.health as a project-application

A personal health research page. You log metrics, lab results and symptoms; the project-scoped
`clinic` space flags what's outside the reference range in plain language, and (on the subscription
tier) reads the literature and writes it up with citations — so you walk into an appointment informed
instead of anxious.

> **Not medical advice.** This app is an informational research aid over your own data. It does not
> diagnose or treat. `settings.acceptedDisclaimer` gates first use; every clinic charter states the
> agents summarise your data and the literature, cite sources, and never diagnose or prescribe.

- The model it's built on (`database/ api/ pages/ hooks/ components/ spaces/`) →
  [org/docs/format/project/](../../../org/docs/format/project/README.md); how an app is built, served and
  executed → [org/docs/app/](../../../org/docs/app/README.md).
- The full behavioral spec → [`app-specifications/health-application.md`](../../../app-specifications/health-application.md).
- **The authoritative inventory of tables, endpoints, pages, hooks and agents is the tree itself.**

## Run locally

Materialize this dir into a temp `LMTHING_ROOT`'s `<root>/health/` (excluding `types/ .data/
node_modules/ tests/`), then from `sdk/org`:

```bash
LMTHING_ROOT=$ROOT LM_MODEL=S node libs/cli/dist/cli/bin.js serve --port 8080
# → GET localhost:8080/app/health/ ; api at /app/health/api/<name> ; manifest at /api/projects/health/app
```
