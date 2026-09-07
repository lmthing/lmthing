`tasklists/<slug>/index.md` plus numbered step files (`01-plan.md`, `02-detail.md`, ...) define a
multi-step, checkpointable workflow an agent can run instead of freehand tool calls. Like functions,
this is not something `create_agent` exposes — it's a deliberate change made directly to the space
files on disk, since a tasklist can itself gate which functions/agents a step may use.
