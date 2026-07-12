---
name: openclaw-compat
description: Load when running OpenClaw plugin code as-is on a compute pod — the `@lmthing/openclaw-compat` package (loader, Proxy-backed api, CompatHost), `.openclaw-plugins/` boot, the `tool()` global, plugin HTTP routes on the Triggers ingress, or the packaging/npm/socket-mode constraints.
---

# Skill: OpenClaw Compat (run OpenClaw plugins verbatim on the pod)

Use this skill when you are touching `@lmthing/openclaw-compat` (`sdk/org/libs/openclaw-compat/`),
its pod host (`sdk/org/libs/cli/src/server/openclaw-host.ts`), the `.openclaw-plugins/` boot path in
`serve.ts`, the `tool()` global, or the plugin-route fallback on `POST /api/inbound/:path`. It is a
**pod-side compatibility host**: it runs an OpenClaw plugin's own `register(api)` as full-privilege
Node inside the user's single-tenant pod — not the QuickJS sandbox.

## Read first (the grounded truth lives here)

- `org/docs/libs/openclaw-compat.md` — **the** page for this area: the fail-loud Proxy api and what
  `IMPLEMENTED_TOP_LEVEL` actually covers, `registerTool`/`registerHttpRoute`/`registerChannel`/
  provider recording, `runtime.subagent.run`, the loader (esbuild transpile + `moduleOverrides` +
  `BUILTIN_SHIMS`), bundled-channel loading, `PluginRegistry`, `CompatHost` + `createComputeCompatHost`,
  `loadOpenClawPlugins`, boot wiring, the `tool()` global and its `tools:use` capability gate,
  packaging in the compute image, current support vs. gaps, and the file map.
- `org/docs/cli-api/rest/webhooks.md` — the inbound ingress a plugin's HTTP route rides on
  (bindings always win; plugin routes are the fallback).
- `org/docs/runtime-globals/events-and-integrations.md` — the event pipeline those routes feed.
- `org/docs/runtime-globals/README.md` — the capability model behind `tools:use`.

Do not trust any per-extension compatibility count you remember: verdicts are a pure function of the
entry shape plus which `api.register*` methods `register()` calls. Re-derive them against the current
`IMPLEMENTED_TOP_LEVEL` in `src/api.ts` rather than quoting a stale table.

## Procedure

**Test**
```bash
pnpm --filter @lmthing/openclaw-compat test     # loader, api Proxy, tavily-load, wins
pnpm --filter @lmthing/cli test -- openclaw     # host + boot wiring
```

**Drive locally** — drop a plugin under `<root>/.openclaw-plugins/<name>/` (needs
`package.json#openclaw.extensions[0]` and `openclaw.plugin.json#id`), boot a credentialed pod, then
`POST /api/inbound/<path>`. Confirm the pod logs `[openclaw] loaded plugin "..."` and
`mounted HTTP route ...`. No `.openclaw-plugins/` dir ⇒ the whole path is a no-op, so existing pods
are unaffected.

**Verify in prod** — set `LM_OPENCLAW_AGENT` (`space/agent`), POST via
`<gateway>/api/inbound/<inboundJWT>/<path>`, and read the persisted session snapshot. Idle
scale-to-zero fights `kubectl exec`, so drive through the gateway rather than exec'ing into the pod.

**Before shipping any change that adds/moves a runtime dependency** — `@lmthing/openclaw-compat` is a
cli dependency and must be built and shipped by `devops/argocd/compute/Dockerfile` in dependency order
(core → openclaw-compat → cli), including its `node_modules` (its dist imports esbuild at runtime).
Getting this wrong crash-loops every pod on `Cannot find package`. Details:
`org/docs/libs/openclaw-compat.md` § Packaging.

## Keep the docs true

GROUND TRUTH IS THE CODE. If you change the implementation, update the matching org/docs page in the
same change (see `org/docs/SYNC.md`).
