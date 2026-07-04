# lmthing.health — personal health research page

A project-application on the shared pod runtime: a project-rooted SQLite db (`database/`), a
client-side React dashboard (`pages/`), named typed Node endpoints (`api/`), interpreter/digest
triggers (`hooks/`), and the **`clinic`** space (`spaces/clinic/`) — the `logger`, `interpreter`, and
`researcher` specialists that maintain the app.

You log metrics, lab results, and symptoms; the **interpreter** flags what's outside the reference
range in plain language; and (on the subscription tier) the **researcher** reads the literature and
writes it up with citations, so you walk into an appointment informed instead of anxious.

> **Not medical advice.** This app is an informational research aid over your own data. It does not
> diagnose or treat. `settings.acceptedDisclaimer` gates first use; every clinic charter states the
> agents summarise your data and the literature, cite sources, and never diagnose or prescribe.

## Local run

Materialize this dir into a temp `LMTHING_ROOT`'s `<root>/health/` (excluding `types/ .data/
node_modules/ tests/`), then from `sdk/org`:

```bash
LMTHING_ROOT=$ROOT LM_MODEL=S node libs/cli/dist/cli/bin.js serve --port 8080
# → GET localhost:8080/app/health/ ; api at /app/health/api/<name> ; manifest at /api/projects/health/app
```

See `automation/app-builder/PROGRESS.health.md` for the build log and engine contracts.
