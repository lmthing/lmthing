# `package.json` — space manifest (store / integration spaces)

**Project-scoped spaces need no `package.json`.** A store-distributed space carries an `lmthing`
block that describes it for the store catalog and for the Chat **Integrations** settings form.

## Format

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

## The `lmthing` block

| Field | Purpose |
|---|---|
| `kind` | Space kind — `integration` for the store integration spaces. |
| `title` | Human display name (catalog + Integrations tab). |
| `tags` | Catalog facets (e.g. `["integration"]`, `["integration","messaging"]`). |
| `icon` | Emoji shown on the catalog card. |
| `description` | One-line summary. |
| `settings` | **JSON Schema** for the space's config/secrets. |

## `settings` — the config form

`settings` is a JSON Schema object. The Chat Integrations tab renders it as a form and writes the
values to pod env (via GET-merge-PUT `/api/compute/env`); a save restarts the pod. Each property's
`title` is the field label; **`format: "password"`** masks secret fields; `required` lists the keys
that must be set (surfaced as `missingRequired`).

The store's generated `projects/manifest.json` copies this `settings` schema (plus the space's
`events`, `inbound`, `functions`, `agents`, `files`) into each space's catalog entry — see
[../README.md](../README.md#distribution--the-store-catalog).

Bare (unscoped) `name` is the convention for store spaces (`integration-slack`, not `@lmthing/…`).

Real example: `store/spaces/integration-slack/package.json`.
