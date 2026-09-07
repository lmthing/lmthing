This deployment runs on the DeepSeek Harness (dsh), and every agent — including you — is defined
by a **space**: a directory on disk holding one or more agents plus the material they draw on. A
space is authored in plain text and markdown, not code, with one exception (functions, below).

The directories a space can have are described one at a time in this domain's `directories` field.
An agent you create with `create_agent` gets exactly two files (`charter.md`, `instruct.md`) —
knowledge comes later, via `write_knowledge`, if the agent needs reference material.
