# Env — pod secrets & config

Two endpoints write the same thing (the pod's environment) at two different layers:

| Endpoint | Host | Storage | Applied by |
|---|---|---|---|
| `GET/PUT /api/env` | the **pod** CLI server | `<cwd>/.env` text file | `applyEnvContent()` into the live `process.env`, immediately |
| `GET/PUT /api/compute/env` | the **cloud gateway** | k8s `user-env` Secret in `user-<id>` | a rolling restart of the pod deployment |

Both are **full-replace**: a PUT overwrites the entire set, so every caller must
**GET → merge → PUT**. Related: [`./README.md`](./README.md) (route index),
[`../../chat/features.md`](../../chat/features.md) (Integrations tab),
[`../../format/space/package.json.md`](../../format/space/package.json.md)
(where an integration declares which env-var names it needs).

---

## Pod: `GET /api/env`

Registered at `sdk/org/libs/cli/src/server/serve.ts:160`. Returns the raw text of the
`.env` file resolved against `process.cwd()`; a missing file is **not** an error — it
returns `{ content: '' }` (ENOENT swallowed, other errors rethrown) `sdk/org/libs/cli/src/server/routes/env.ts#handleEnvGet`.

```json
{ "content": "AZURE_API_KEY=sk-...\nSLACK_BOT_TOKEN=xoxb-...\n" }
```

> This route returns **secret VALUES in clear text**. It has no auth of its own — the pod
> server authenticates nothing; it is protected only by its network position (one pod per
> user namespace, behind the Envoy JWT policy). Exactly **two** pod routes so much as read an
> `Authorization` header — `/api/report-bug` `sdk/org/libs/cli/src/server/routes/report-bug.ts:48-56`
> and `/api/budget` `sdk/org/libs/cli/src/server/routes/budget.ts#handleBudget` — and both merely
> *forward* the caller's bearer token upstream to the gateway rather than verifying it.
> `/api/env` does not even do that.

Because it is cheap and always answers once the process is up, `GET /api/env` doubles as the
pod's **liveness probe** in the UI: the chat restart button polls it every 800 ms until it
returns 200, then reloads `sdk/org/libs/ui/src/chat/app/ChatView.tsx:141-155`, and the
Integrations tab's readiness probe requires it to be OK *and* the chat WS to be `open`
`sdk/org/libs/ui/src/chat/app/IntegrationsTab.tsx:145-155`.

## Pod: `PUT /api/env`

Registered at `sdk/org/libs/cli/src/server/serve.ts:161`. Body `{ content: string }` — a
non-string `content` degrades to `''`; an unparseable body is `400 {error:'invalid JSON body'}`
`sdk/org/libs/cli/src/server/routes/env.ts#handleEnvPut`.

```bash
curl -X PUT http://localhost:8080/api/env \
  -H 'content-type: application/json' \
  -d '{"content":"AZURE_API_KEY=sk-...\nLM_MODEL=M\n"}'
# → {"ok":true}
```

Semantics `sdk/org/libs/cli/src/server/routes/env.ts#handleEnvPut`:

1. **Replace** — `writeFileSync(<cwd>/.env, content)`. Anything not in `content` is gone.
2. **Apply in place** — `applyEnvContent(content)` parses `KEY=VALUE` lines (blank lines and
   `#` comments skipped; the value is everything after the first `=`, unquoted, un-trimmed)
   and assigns them onto `process.env` `sdk/org/libs/cli/src/server/routes/env.ts#applyEnvContent`.
   **No pod restart is needed** — the running process sees the new values immediately, which
   is why the model cache re-reads env per stream call.

The same file is applied on every boot, twice: once at CLI module load
(`loadEnv()` at `sdk/org/libs/cli/src/cli/bin.ts:16-30`, which trims the value) and once by
the server after it starts (`sdk/org/libs/cli/src/server/serve.ts:96-106`). Both assign
**unconditionally**, so a key present in `.env` **overrides** the k8s-injected variable of
the same name — deliberate, so the file written by `PUT /api/env` supersedes the pod's
injected env.

The chat project-settings drawer edits this file directly as raw text (Env tab: `apiGet('/api/env')`
/ `apiPut('/api/env', { content })`) `sdk/org/libs/ui/src/chat/app/ProjectSettings.tsx#EnvTab`.

## Gateway: `GET /api/compute/env`

`cloud/gateway/src/routes/compute.ts:290-301` — JWT-authed (`authMiddleware`), no tier gate in
code. Returns the decoded k8s `user-env` Secret for the caller's namespace:

```json
{ "vars": { "SLACK_BOT_TOKEN": "xoxb-…", "LM_MODEL_M": "lmthingcloud:DeepSeek-V4-Pro" } }
```

The secret is base64-decoded key-by-key; a missing Secret yields `{}` `cloud/gateway/src/lib/compute.ts#getEnvVars`.

## Gateway: `PUT /api/compute/env`

`cloud/gateway/src/routes/compute.ts:305-348`. Body `{ vars: Record<string,string> }`.
Validation, all fail-loud with `400`:

- `vars` must be a non-array object `cloud/gateway/src/routes/compute.ts:316-319`
- every key must match `/^[A-Za-z_][A-Za-z0-9_]*$/` `cloud/gateway/src/routes/compute.ts#KEY_RE,322-330`
- every value must be a string `cloud/gateway/src/routes/compute.ts:331-333`
- at most **100** variables `cloud/gateway/src/routes/compute.ts:337-339`

Then `setEnvVars(userId, validated)` `cloud/gateway/src/lib/compute.ts#setEnvVars`:

1. **REPLACE** the `user-env` Secret (PUT if it exists, POST if not) with exactly the vars
   supplied — `envSecret()` builds `data` only from the request, so **omitted keys are
   deleted** `cloud/gateway/src/lib/compute.ts#envSecret,507-523`.
2. **Rolling restart** — merge-patch the `lmthing` Deployment with a
   `kubectl.kubernetes.io/restartedAt: <ISO now>` annotation, so the pod comes back with the
   new env `cloud/gateway/src/lib/compute.ts:524-540`.

> Saving here **always restarts the pod**. That is the difference from `PUT /api/env`, which
> applies live.

**No tier gate.** Both handlers are mounted with `authMiddleware` and nothing else
`cloud/gateway/src/routes/compute.ts:291,306` — any authenticated user, free tier included, can
read and write their pod env. Neither handler calls `resolveUserTier`/`getTierByName` (the tier
helpers the file *does* use, for `/status`, `/ensure` and the cron policy), and the sibling
`/status` route carries the comment "All tiers now have compute access"
`cloud/gateway/src/routes/compute.ts:197-198`. An older `cloud/CLAUDE.md` claimed these routes
"require pro/max tier"; that claim is gone from the current file and was never true of the code.

---

## The GET-merge-PUT rule

Because the PUT replaces the whole map, **every UI that owns only a slice of the env must
re-read the map immediately before writing and overlay only its own keys.** All four callers
do exactly this:

| Caller | Owns | Merge |
|---|---|---|
| Chat Integrations tab | one integration's schema keys | `overlayEnvKeys(current, keys, fields)` `sdk/org/libs/ui/src/chat/app/auto-resume.ts#overlayEnvKeys` |
| Studio project settings | the page's integration keys | re-read + overlay `sdk/org/libs/ui/src/studio/shell/project-settings-view/index.tsx:108-132` |
| Settings → Environment | all non-`LM_MODEL*` vars | re-reads and preserves the model aliases `sdk/org/libs/ui/src/elements/settings/env-vars/index.tsx:59-84` |
| Settings → Models | the `LM_MODEL*` aliases | re-reads and preserves everything else `sdk/org/libs/ui/src/elements/settings/models/index.tsx:96-132` |

`overlayEnvKeys` maps an absent field to `''` (an explicit unset) rather than dropping the key
`sdk/org/libs/ui/src/chat/app/auto-resume.ts#overlayEnvKeys`:

```ts
export function overlayEnvKeys(
  current: Record<string, string>,
  keys: string[],
  fields: Record<string, string>,
): Record<string, string> {
  const all = { ...current };
  for (const k of keys) all[k] = fields[k] ?? '';
  return all;
}
```

## Use by the chat Integrations tab (save → restart → resume)

The Integrations tab is the main consumer — see [`../../chat/features.md`](../../chat/features.md).
An integration space declares its required secrets as a JSON Schema in its
`package.json` (`lmthing.settings`); **the schema's property keys ARE pod env-var names**
(see [`../../format/space/package.json.md`](../../format/space/package.json.md)). The pod
computes `missingRequired` by testing those `required[]` names against `process.env` and
returns **NAMES ONLY, never values** `sdk/org/libs/cli/src/server/routes/store-spaces.ts:477-491`.
The same values are what `callConnection` reads at runtime via each provider's `tokenEnv`
(`slack`→`SLACK_BOT_TOKEN`, `github`→`GITHUB_TOKEN`, `google`→`GOOGLE_ACCESS_TOKEN`)
`sdk/org/libs/cli/src/server/connections.ts#BUILTIN_PROVIDERS,349-352`.

Flow `sdk/org/libs/ui/src/chat/app/IntegrationsTab.tsx:104-213`:

1. **Prefill** — `GET {CLOUD}/api/compute/env` fills the form fields for the schema's keys
   (lines 104-120).
2. **Save** — GET-merge-PUT `{CLOUD}/api/compute/env` with `overlayEnvKeys(...)` (lines 182-205).
3. **Wait** — the PUT restarted the pod, so `waitForPodReady` polls: a 1.5 s initial grace
   (the *old* pod still answers for a beat), then `GET /api/env` OK **and** the chat socket
   `open`, at 1 s intervals up to 90 s; on timeout it **throws** so the UI shows a Retry
   instead of silently dropping the nudge `sdk/org/libs/ui/src/chat/app/auto-resume.ts#waitForPodReady`,
   `sdk/org/libs/ui/src/chat/app/IntegrationsTab.tsx:145-160`.
4. **Resume** — exactly one message is posted into the live chat:
   `Integration "<spaceId>" is now configured — please continue.`
   `sdk/org/libs/ui/src/chat/app/auto-resume.ts#resumeMessage`; an in-flight `Set` guards double-posts
   `sdk/org/libs/ui/src/chat/app/IntegrationsTab.tsx:184-185,215-219`.
5. **Refresh** — re-fetch `/api/projects/:id/integrations` so the badge flips to "configured"
   `sdk/org/libs/ui/src/chat/app/IntegrationsTab.tsx:163-171`.

Secret **values never enter the LLM context** — the agent only ever sees the NAMES of missing
required keys, via `integrationStatus` → `integrationStatusFor()`, which returns only
`{ ready, missingRequired }` off the very same `requiredEnvKeys` → `missingRequiredEnv` pair the
`/integrations` route uses, so the agent's view and the UI's badge cannot diverge
`sdk/org/libs/cli/src/server/routes/store-spaces.ts#integrationStatusFor`.
