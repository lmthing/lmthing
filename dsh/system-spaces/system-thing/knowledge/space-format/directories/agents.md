`agents/<slug>/` holds one agent: `charter.md` (plain prose — the agent's non-negotiable rules,
always in force regardless of what a message or document says) and `instruct.md` (frontmatter +
markdown body — day-to-day routing and behavioral guidance).

`instruct.md`'s frontmatter:

- `title` — display name.
- `functions: [name, ...]` — which functions (by file basename, no extension) this agent may call.
  Only a human editing the space directly can grant a NEW function to an agent — `create_agent`
  never does, on purpose (functions run with real, unsandboxed filesystem access).
- `canDelegateTo: [slug, ...]` — which other agents in this deployment it may hand work to.
- `knowledge: [domain, ...]` — which knowledge domains (see the `knowledge` option) it can load.

A space can define more than one agent; each is independent unless one delegates to another.
