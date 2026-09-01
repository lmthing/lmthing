## The greeting

`greet(name)` returns `Hello, <name>!` — the literal word `Hello`, a comma, a space, then the name passed in, closed with an exclamation mark. `greet("Ada")` produces exactly `Hello, Ada!`.

One required string parameter, one string result: nothing to configure, no state to consult. When an agent needs a sample of what a pure function is, this one is the smallest honest example — and its schema is derived from the signature alone, so the `@param` line on `name` is the only reason the model knows what to pass.