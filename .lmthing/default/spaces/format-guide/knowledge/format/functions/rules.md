## Function rules

A space function is PURE and self-contained: positional parameters in, return value out. There are no ambient globals — no `db`, `ask`, `display`, `emitEvent`; those died with the REPL runtime. `undefined` results are serialized as `null`; a thrown error becomes a tool error, never a crash.

Author through `write_function`: it returns the DERIVED schema, so inspect it immediately — that object is exactly what the model will see.