# `project.json` — project descriptor

Minimal browse/identity metadata for a project-app. `demo-feed` uses a standalone `project.json`;
the other catalog apps carry the same identity fields on their [`package.json`](./package.json.md)
instead — **either is accepted**.

## Format

```json
{
  "id": "demo-feed",
  "title": "Personal Feed",
  "description": "A personal reading feed with a table, list/mark-read/add-item API, a page, and a db hook that enriches new items.",
  "icon": "📰"
}
```

## Fields

| Field | Type | Notes |
|---|---|---|
| `id` | string | Lowercase slug. Also the on-disk directory name and the install/route id (`/app/<id>/`). |
| `title` | string | Human display name shown in the store catalog. |
| `description` | string | One-line summary for the catalog card. |
| `icon` | string | Emoji (or `null`). Shown on the catalog card. |

These four fields are what the store's generated `projects/manifest.json` surfaces for each app
(`icon` may be `null`). See [../README.md](../README.md#distribution--the-store-catalog).

Real example: `store/projects/demo-feed/project.json`.
