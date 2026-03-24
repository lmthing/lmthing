# Plan: Phase 1c — `stop()` Promise-Awaiting

## Context

Currently, when the agent passes a Promise to `stop()`, it gets serialized as `[Promise]` — the agent sees no useful value. The agent must manually `await` every promise before passing it to `stop()`. Phase 1c makes `stop()` transparently await any Promise argument before building the payload, so the agent can write:

```ts
var data = fetch("https://api.example.com/data").then((r) => r.json());
var file = readFile("/src/index.ts");
stop(data, file);
// ← stop { data: { ... }, file: "contents..." }
```

This is independent of all other phases (no dependencies).

---

## Changes

### 1. `src/sandbox/globals.ts` — `stopFn` (lines 72-106)

**What:** After recovering argument names and before building the payload, detect which values are Promises and await them all concurrently.

**How:**

```ts
async function stopFn(...values: unknown[]): Promise<void> {
  const argNames = recoverArgumentNames(currentSource);

  // Await any Promise values concurrently
  const resolved = await Promise.allSettled(
    values.map((v) => (v instanceof Promise ? v : Promise.resolve(v))),
  );

  // Build payload from resolved values
  const payload: StopPayload = {};
  for (let i = 0; i < resolved.length; i++) {
    const key = argNames[i] ?? `arg_${i}`;
    const settlement = resolved[i];
    const value =
      settlement.status === "fulfilled"
        ? settlement.value
        : {
            _error:
              settlement.reason instanceof Error
                ? settlement.reason.message
                : String(settlement.reason),
          };
    payload[key] = {
      value,
      display: serialize(value, config.serializationLimits),
    };
  }

  // ... rest unchanged (async merge, pause, onStop)
}
```

Key details:

- Use `Promise.allSettled` (not `Promise.all`) so one rejection doesn't block others
- Non-Promise values pass through via `Promise.resolve(v)` — zero overhead for already-resolved values
- Rejected promises produce `{ _error: "message" }` so the agent sees what went wrong
- The `instanceof Promise` check covers native Promises and any thenable that's a proper Promise instance

### 2. `src/sandbox/globals.test.ts` — New test cases

Add tests for:

- **Resolving Promise arguments**: `stop(Promise.resolve(42))` → payload contains `42`, not `[Promise]`
- **Multiple mixed values**: `stop(1, Promise.resolve("hello"), true)` → all resolved correctly
- **Rejected Promise**: `stop(Promise.reject(new Error("fail")))` → payload contains `{ _error: "fail" }`
- **Concurrent resolution**: Multiple promises resolve concurrently (not sequentially)
- **Non-Promise values unchanged**: `stop(42, "hello")` works identically to before

### 3. `src/stream/serializer.ts` — No changes needed

The `[Promise]` branch (line 66-68) stays as a safety net for Promises nested inside objects/arrays that aren't top-level stop arguments. Top-level Promises will be resolved before reaching the serializer.

---

## Files to modify

| File                          | Change                                                       |
| ----------------------------- | ------------------------------------------------------------ |
| `src/sandbox/globals.ts`      | Await Promise values in `stopFn` before payload construction |
| `src/sandbox/globals.test.ts` | Add 5 new test cases for Promise-awaiting behavior           |

---

## Verification

1. Run existing tests to confirm no regressions: `pnpm test src/sandbox/globals.test.ts`
2. Run serializer tests: `pnpm test src/stream/serializer.test.ts`
3. Run full test suite: `pnpm test`
