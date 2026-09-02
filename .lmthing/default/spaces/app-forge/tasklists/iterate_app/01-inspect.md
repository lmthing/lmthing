---
id: inspect
output:
  findings: array
---

Read the app AS IT IS. List `database/`, `api/`, `views/`, `components/`, `hooks/` and read the artifacts the iteration will touch — the real names on disk are the ground truth, and a concept an existing artifact already covers is extended under its REAL name, never re-invented under a second one. Run the whole-app check and the live smoke so findings are evidence, not impressions: an orphan page, a nav target that is not a route, an empty render, an always-null binding, a page with no data-bound section, a handler whose Output cannot satisfy its section. Record every finding as `findings` — one item per finding, `{ area, detail, severity }`, where `area` names the pillar (`database` / `api` / `views` / `hooks` / `shell`), `detail` says what is wrong against WHICH artifact, and `severity` is `fix` when it breaks the app or the gate and `polish` when it is worth doing only if there is room. An app with no findings records an empty list.