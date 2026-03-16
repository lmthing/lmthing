# Security — Implementation Guide

## Overview

Security constraints for the REPL sandbox, function registry, and JSX rendering.

**Full specification:** [docs/host-runtime-contract/security-and-lifecycle.md](../../docs/host-runtime-contract/security-and-lifecycle.md)

## Sandbox Isolation

The REPL sandbox must **not** have access to:
- Host filesystem (beyond explicitly provided functions)
- Network (beyond explicitly provided functions)
- `process`, `require`, `import()`, `eval`, `Function` constructor
- `globalThis` modification beyond the injected API

## Function Registry

All agent-accessible functions are proxy-wrapped to enforce:
- Argument type validation
- Timeouts (default 30s per call)
- Invocation logging
- Rate limiting

## JSX Sanitization

Before rendering any JSX from the agent:
- Disallow `dangerouslySetInnerHTML`
- Disallow `<script>` tags
- Disallow `javascript:` URLs
- Validate that `ask` forms only contain registered input components
