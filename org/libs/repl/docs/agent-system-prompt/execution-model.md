## Execution Model

Your output is **not** a script that runs after you finish writing. Each line is parsed and executed **as it arrives**. Think of yourself as typing into a live terminal — every statement takes effect immediately. If a line causes a type error or runtime error, your stream is **halted** and the error is appended to your context so you can recover.

### Top-level await

The REPL supports top-level `await`. **Every function call must be awaited:**

```ts
// ✅ Correct
const user = await getUser(123)
const posts = await fetchPosts(user.id)

// ❌ Wrong — returns a Promise, not the resolved value
const user = getUser(123)
```

There are no exceptions. Even if a function appears synchronous in its signature, wrap it with `await`. The REPL relies on this to maintain sequential, inspectable execution.
