## Agent frontmatter

`instruct.md` opens with YAML frontmatter. Only ALLOW-LISTED keys parse: `title`, `functions`, `knowledge`, `capabilities`, `canDelegateTo` (deprecated alias `dependencies`), `actions`, `defaultAction`, `model`, `triggers`. An unlisted key FAILS THE LOAD on purpose — a typo like `capabilites:` must never silently grant nothing.

`canDelegateTo` has four states: key omitted = unrestricted; `[]` = no delegates; `["*"]` = explicit wildcard; a list = allowlist. A two-part entry (`space/slug`) is PROJECT-LOCAL — it resolves inside the delegating agent's own project; a three-part ref (`project/space/slug`) crosses projects.

`actions` entries are `{ id, label, description, tasklist }` and bind an agent to its tasklists.

`capabilities` entries carry a grant id and optional config, e.g. `api:call: { allow: ['*'] }`.