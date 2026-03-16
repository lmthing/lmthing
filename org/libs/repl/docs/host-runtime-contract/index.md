# Runtime Contract — Host Implementation Guide

This document describes how the host system implements the other side of the agent protocol defined in the system prompt. It is written for the engineering team building the REPL runtime, the stream controller, and the React rendering layer.

---

## Architecture Overview

```
┌─────────────┐     token stream     ┌──────────────────┐     execute     ┌──────────────┐
│  LLM Agent  │ ──────────────────▶  │  Stream Parser &  │ ─────────────▶ │  TypeScript   │
│  (provider) │ ◀──────────────────  │  Line Accumulator │ ◀──────────── │  REPL Sandbox │
│             │   context injection  │                   │    results     │              │
└─────────────┘                      └──────────────────┘                └──────────────┘
                                            │                                   │
                                            ▼                                   │
                                     ┌──────────────┐                          │
                                     │  React       │ ◀────────────────────────┘
                                     │  Render      │    display() / ask() calls
                                     │  Surface     │
                                     └──────────────┘
```

There are four subsystems:

1. **Stream Controller** — manages the LLM connection, token accumulation, pause/resume, and context injection.
2. **Line Parser** — buffers tokens into complete statements and detects global calls (`stop`, `display`, `ask`, `async`).
3. **REPL Sandbox** — executes TypeScript line-by-line, maintains persistent scope, captures errors.
4. **React Render Surface** — mounts components from `display` and `ask`, handles user interaction, returns form data.

---

## Table of Contents

- [Stream Controller](stream-controller.md) — Token accumulation, statement completeness, pause/resume, context injection, serialization rules
- [REPL Sandbox](repl-sandbox.md) — Scope persistence, TypeScript compilation, injected globals, error capture
- [Globals Implementation](globals-implementation.md) — `stop`, `display`, `ask`, and `async` implementation details
- [User Intervention](user-intervention.md) — User messages mid-execution, ask cancellation, pause/resume, async task cancellation
- [Developer Hooks](developer-hooks.md) — AST-based code interception, pattern language, hook actions, execution pipeline
- [Workspace and Context](workspace-and-context.md) — Scope generation, system prompt mutation, context window management, compression strategies
- [Security and Lifecycle](security-and-lifecycle.md) — Sandbox isolation, function registry, JSX sanitization, session lifecycle
- [Wire Format and Types](wire-format-and-types.md) — Message wire format, type definitions, worked example
