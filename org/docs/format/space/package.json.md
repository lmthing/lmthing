# `package.json` — space manifest (`lmthing` block)

A **project-scoped** space (one that lives under a project's `spaces/<id>/`) needs no `package.json` at all — the core space loader reads it only when it exists, and even then only for the npm package `name` and to install declared `dependencies` (`sdk/org/libs/core/src/spaces/load.ts:606-623`). A space with no `package.json` (or one with no dependencies) loads fine — the `if (await fileExists(pkgJsonPath))` guard skips it entirely (`sdk/org/libs/core/src/spaces/load.ts:612`).

The `lmthing` block matters for **store-distributed** spaces: it describes the space for the store catalog and drives the Chat/Studio **Integrations** settings form (`store/scripts/gen-apps-manifest.mjs:448-479`, `sdk/org/libs/cli/src/server/routes/store-spaces.ts:520-526`). The core runtime never reads the `lmthing` block — it is consumed purely by the manifest generator and the pod's integration endpoints.

## Format

Real example — `store/spaces/integration-slack/package.json`:

```json
{
  "name": "integration-slack",
  "version": "1.0.0",
  "private": true,
  "lmthing": {
    "kind": "integration",
    "title": "Slack",
    "tags": ["integration"],
    "icon": "🔌",
    "description": "Post to Slack and receive Slack messages via THING.",
    "settings": {
      "type": "object",
      "properties": {
        "SLACK_BOT_TOKEN":      { "type": "string", "title": "Bot token",      "format": "password" },
        "SLACK_SIGNING_SECRET": { "type": "string", "title": "Signing secret", "format": "password" }
      },
      "required": ["SLACK_BOT_TOKEN", "SLACK_SIGNING_SECRET"]
    }
  }
}
```

This is the on-disk example verified verbatim at `store/spaces/integration-slack/package.json:1-19`.

## The `lmthing` block

A `package.json` with no `lmthing` block is skipped by the store manifest generator (`loadSpaceEntry` returns `null`), so it never becomes a catalog entry (`store/scripts/gen-apps-manifest.mjs:450-451`).

| Field | Purpose | Grounding |
|---|---|---|
| `kind` | Space kind. `kind === 'integration'` is what the pod's integration scan filters on to surface a space in the Integrations panel. | `sdk/org/libs/cli/src/server/routes/store-spaces.ts:561`, manifest copy `store/scripts/gen-apps-manifest.mjs:466` |
| `title` | Human display name; falls back to a title-cased id (`humanizeId`) when absent. | `store/scripts/gen-apps-manifest.mjs:462`, `store-spaces.ts:575` |
| `tags` | Catalog facets; defaults to `[]`. | `store/scripts/gen-apps-manifest.mjs:465`, `store-spaces.ts:577` |
| `icon` | Emoji shown on the catalog card / settings row; defaults to `null`. | `store/scripts/gen-apps-manifest.mjs:464`, `store-spaces.ts:576` |
| `description` | One-line summary; falls back to the package `description`. | `store/scripts/gen-apps-manifest.mjs:463` |
| `settings` | JSON Schema for the space's config/secrets; defaults to `null`. | `store/scripts/gen-apps-manifest.mjs:467`, `store-spaces.ts:578` |

## `settings` — the Integrations config form

`settings` is a **JSON Schema** object; the Integrations tab renders it as a form (`sdk/org/libs/ui/src/studio/integrations/SettingsSchemaForm.tsx:46-79`). The form iterates `schema.properties` and renders one labeled `@lmthing/ui` `<Input>` per property (`SettingsSchemaForm.tsx:57-74`). Each property's `title` (falling back to the property key) is the field label (`SettingsSchemaForm.tsx:63`), and `description` becomes the input placeholder (`SettingsSchemaForm.tsx:71`).

**`format: "password"`** masks a secret field — the input renders as `type="password"`; any other value renders plain `type="text"` (`SettingsSchemaForm.tsx:68`). The schema handles string properties only (`SettingsSchemaForm.tsx:3-6,18-25`).

`required` marks which fields are mandatory: `requiredKeys` is built from `schema.required` and passed to the field `<Label required={…}>` (`SettingsSchemaForm.tsx:48,62`). The same `required` list drives **`missingRequired`** — the pod's integration route treats each schema property key as a pod env-var NAME and reports the `required` names that are unset or empty in `process.env` (`store-spaces.ts:479-491,572`). `configured` is the convenience boolean `missingRequired.length === 0` (`store-spaces.ts:474,581`). Only the missing NAMES are surfaced — secret VALUES never leave the pod (`store-spaces.ts:470-472`).

On save, the form writes the values to pod env via a GET-merge-PUT against the gateway `/api/compute/env` (the PUT replaces the whole var set, so it re-reads fresh and merges first), which restarts the pod (`sdk/org/libs/ui/src/chat/app/IntegrationsTab.tsx:189-204`). Once the pod is serving again, one resume nudge is posted into the active chat via `onConfigured` so THING continues (`IntegrationsTab.tsx:54-57,161`).

## The catalog entry

The store manifest generator lifts each store space into a `CatalogSpace` entry in `store/projects/manifest.json` (`store/scripts/gen-apps-manifest.mjs:448-479`). The entry copies the `lmthing` block's `title`, `description`, `icon`, `tags`, `kind`, and `settings` (`store/scripts/gen-apps-manifest.mjs:462-467`), plus a lifted producer/consumer surface computed from the space's contents: `events` and `inbound` (the union of every `events/*.ts` emitter def's `emits` and each `webhook` def's public inbound path, transpile-validated), `functions` (exported `functions/*.ts` wrappers), `agents` (each agent's slug + declared actions + trigger kinds), and `files` (every space file, so a pod's install endpoint can fetch each one) (`store/scripts/gen-apps-manifest.mjs:453-478`). For `integration-slack` this yields e.g. `settings` with the two password fields and `inbound: [{ path: "slack", verify: "slack" }]` (verified in the generated `store/projects/manifest.json`).

## Conventions

Store spaces use a bare (unscoped) package `name` matching the space id — `"integration-slack"`, not `@lmthing/…` (`store/spaces/integration-slack/package.json:2`).

## See also

- [space/README.md](./README.md) — what a space is, and the distinction between project-scoped and store-distributed spaces.
- [space/agents/README.md](./agents/README.md) — the `agents/` whose slugs, actions, and triggers are lifted into the catalog entry.
