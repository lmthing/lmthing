`functions/<name>.js` is a callable tool. Its exports: `description` (string, shown to the model),
`schema` (the argument shape), optionally `outputSchema`, and a function named exactly like the
file (minus `.js`) that does the work.

Functions run with real, unsandboxed Node filesystem access — there is no sandbox distinguishing
"space-scoped" from general-purpose I/O. That is exactly why `create_agent` and `write_knowledge`
never let a conversation add a NEW function to an agent: doing so would let anything that can talk
to THING eventually get arbitrary code executed on the pod. Adding a real function to a space is a
deliberate, reviewed change made directly to the files on disk, not a tool call.
