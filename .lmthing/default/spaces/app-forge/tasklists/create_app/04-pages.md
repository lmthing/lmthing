---
id: pages
dependsOn:
  - api
  - schema
output:
  pages: array
---

Author the pages as view specs. Load `project/layout/pages` first — the route grammar, the eight section kinds and the binding roots live there. Validate EVERY route with `checkPagePath` BEFORE writing it: kebab-case segments, no extension, no leading/trailing slash, `[param]` camelCase; a first segment in the reserved set (`api`, `app`, `assets`, `install`, `chat`, `studio`, `computer`, `favicon.ico`) is shadowed at the clean-URL mount. Write with `writeProjectView` (`views:write`) — `views/<route>.view.json`, never TSX. One section, one endpoint, and the endpoint's Output must satisfy the section's bindings; a `create` section declares no fields. Link pages both ways where they reference each other: a `navigate` to a route that does not exist yet is only a warning at save, so a pair of cross-linking pages is written in either order — but BOTH must exist before this node completes. A `[param]` route is a drill-in reached by `rowAction`/`navigate`, never a nav destination. Record the routes as `pages`.