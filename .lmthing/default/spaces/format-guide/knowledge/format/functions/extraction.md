## Schema extraction

A function's MCP inputSchema is DERIVED from its TypeScript signature and JSDoc — never hand-written: parameters become properties in order; `?` or a default makes them optional; each `@param` line becomes that property's description; the leading JSDoc paragraph becomes the tool description.

An array type MUST emit `items` — a bare `{ type: "array" }` gives a model nothing to aim at. Inline object types recurse; interfaces imported from sibling files resolve through the program.

Every function gets a verdict: `exact`, `degraded` (names the parameter that went opaque and why — fix the type rather than accept it), or `explicit` (an `export const schema` override; the escape hatch, not the path).