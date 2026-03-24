# lmthing Codebase Audit Report

**Date**: 2026-03-15
**Scope**: Full monorepo — cloud backend, shared libraries, frontend apps, configuration & infrastructure

---

## Executive Summary

| Severity | Count |
|----------|-------|
| Critical | 4 |
| High | 11 |
| Medium | 12 |
| Low | 20 |
| Info | 7 |
| **Total** | **54** |

The codebase is well-structured with good separation of concerns and a clean monorepo layout. However, several critical security issues need immediate attention: an unsafe code execution sandbox, weak XOR encryption for env files, empty-string fallbacks for token signing secrets, and disabled JWT verification on protected endpoints.

---

## Critical Findings

### C-1: Unsafe Code Execution via `new Function()` + `with` Statement
- **File**: `org/libs/core/src/plugins/function/sandbox.ts:226-228`
- **Issue**: User code is string-concatenated into `new Function()` with a `with` statement, enabling scope chain escapes and arbitrary code injection.
- **Fix**: Replace with Web Workers for browser sandboxing. Never concatenate user code into `new Function()`.

### C-2: Weak XOR Encryption for Environment Files
- **File**: `org/libs/state/src/lib/fs/crypto/env.ts:239-278`
- **Issue**: `encryptEnvFileSync`/`decryptEnvFileSync` use XOR with a repeating 32-byte key — trivially breakable with known-plaintext attacks, and lacks authentication (no HMAC/AEAD).
- **Fix**: Deprecate sync XOR functions; migrate all callers to the async AES-GCM implementations already in the codebase.

### C-3: Empty Token Secrets Default to Empty String
- **File**: `cloud/supabase/functions/_shared/container.ts`
- **Issue**: `SPACE_TOKEN_SECRET` and `COMPUTER_TOKEN_SECRET` fall back to `""` via `?? ""`, making HMAC tokens completely predictable/forgeable if env vars are unset.
- **Fix**: Remove `?? ""` fallback; throw an error if secrets are missing.

### C-4: JWT Verification Disabled for Protected Endpoints
- **File**: `cloud/supabase/config.toml`
- **Issue**: 5 functions requiring authentication have `verify_jwt = false`: `create-space`, `update-space`, `list-spaces`, `delete-space`, `issue-space-token`. They rely solely on application-level auth middleware, violating defense-in-depth.
- **Fix**: Enable JWT verification at Supabase config level, or document and audit that each function implements its own auth check.

---

## High Findings

### H-1: Open Redirect Vulnerability in Auth Flows
- **Files**: `com/src/routes/login.tsx`, `com/src/routes/auth/sso.tsx`, `com/src/routes/account.tsx`, `com/src/routes/billing.tsx`
- **Issue**: `redirect` parameter from URL query strings used directly in `window.location.href` without validation. Attackers can craft redirect URLs to phishing sites.
- **Fix**: Validate redirect URLs are relative paths or belong to known `*.lmthing.*` domains.

### H-2: Insecure Token Storage in localStorage
- **Files**: `org/libs/auth/src/client.ts`, `studio/src/lib/github/GithubContext.tsx`, `computer/src/routes/settings.tsx`
- **Issue**: JWT access tokens and GitHub tokens stored in unencrypted `localStorage`, vulnerable to XSS exfiltration.
- **Fix**: Use `sessionStorage`, HttpOnly cookies, or implement strict CSP headers.

### H-3: Missing JSON Parse Error Handling on `req.json()`
- **Files**: `generate-ai`, `create-api-key`, `revoke-api-key`, `create-checkout`, `billing-portal`, `create-sso-code`, `exchange-sso-code` (all `index.ts`)
- **Issue**: `await req.json()` called without try-catch; invalid JSON causes a 500 instead of 400.
- **Fix**: Wrap all `req.json()` calls in `.catch()` returning 400 Bad Request.

### H-5: Environment Variable / API Key Exposure
- **File**: `org/libs/core/src/providers/custom.ts:45-91`
- **Issue**: `scanCustomProviders()` stores raw API keys in returned config objects that could be logged or leaked.
- **Fix**: Store only key names/prefixes; retrieve actual keys lazily at request time.

### H-6: CSRF State Validation Race Condition
- **File**: `org/libs/auth/src/client.ts:32-41`
- **Issue**: React StrictMode double-invocation can clear SSO state prematurely, bypassing CSRF protection.
- **Fix**: Use per-state keyed sessionStorage entries with atomic check-and-remove.

### H-8: Type-Unsafe Stripe Event Handlers (`as any`)
- **File**: `cloud/supabase/functions/stripe-webhook/index.ts`
- **Issue**: Stripe webhook event objects cast to `any`; no validation that `subscription.items.data` exists before calling `.some()`.
- **Fix**: Define strict TypeScript types for Stripe events; add property existence checks.

### H-9: Slug Validation Regex Uses `&&` Instead of `||`
- **File**: `cloud/supabase/functions/create-space/index.ts:37`
- **Issue**: Condition `!regex.test(slug) && slug.length < 2` should use `||` — current logic allows invalid slugs through.
- **Fix**: Change `&&` to `||`.

### H-10: Missing `COMPUTER_PRICE_ID` Validation
- **Files**: `cloud/supabase/functions/stripe-webhook/index.ts`, `issue-computer-token/index.ts`
- **Issue**: Defaults to empty string; subscription checks silently never match.
- **Fix**: Throw an error if the env var is missing.

### H-11: Unpinned `vite-plus` Version Across All Apps
- **File**: `pnpm-workspace.yaml` (catalog)
- **Issue**: `vite-plus: latest` creates non-deterministic builds across all 11 product apps.
- **Fix**: Pin to specific semver ranges (e.g., `vite-plus: ^1.x.x`).

### H-12: No Lint/Test Steps in CI/CD Before Deploy
- **File**: `.github/workflows/deploy.yml`
- **Issue**: Deployment pipeline builds and deploys without running linting or tests first.
- **Fix**: Add `pnpm lint` and `pnpm test:run` steps before the build step.

### H-13: State Persistence Without Integrity Checks
- **File**: `org/libs/state/src/lib/contexts/AppContext.tsx`
- **Issue**: localStorage data loaded on mount without schema validation or migration versioning.
- **Fix**: Add Zod schema validation and data migration versioning.

---

## Medium Findings

### M-1: Race Condition in Space/Computer Provisioning
- **Files**: `cloud/supabase/functions/create-space/index.ts`, `provision-computer/index.ts`
- **Issue**: DB record inserted, then Fly.io provisioning runs fire-and-forget. Client gets 201 immediately but provisioning failures are invisible.
- **Fix**: Add status polling mechanism; log provisioning failures to a dedicated error table.

### M-2: Duplicate Stripe Client Initialization
- **File**: `cloud/supabase/functions/get-usage/index.ts:36`
- **Issue**: Creates `new Stripe(...)` directly instead of using shared `getStripe()` from `_shared/stripe.ts`.
- **Fix**: Replace with `const stripe = getStripe()`.

### M-3: Generic 500 Status for All Errors
- **Files**: `list-api-keys`, `list-spaces`, `create-api-key` (all `index.ts`)
- **Issue**: Supabase error codes (e.g., 23505 unique constraint) all return 500 instead of mapping to appropriate HTTP codes.
- **Fix**: Map error code 23505 to 409, 22P02 to 400, etc.

### M-4: No RPC Error Handling for Schema Creation
- **File**: `cloud/supabase/functions/create-space/index.ts:81`
- **Issue**: `supabase.rpc("create_space_schema", ...)` result is not checked for errors.
- **Fix**: Check the `error` return value and handle appropriately.

### M-6: Excessive `any` Type Usage (~502 instances)
- **Location**: Across all org/libs packages, especially core plugins and state hooks.
- **Fix**: Replace with proper interfaces; add ESLint `no-explicit-any` rule.

### M-7: XSS via `dangerouslySetInnerHTML` in Markdown Preview
- **File**: `org/libs/ui/src/components/knowledge/topic-detail/topic-editor/markdown-preview.tsx`
- **Issue**: Rendered HTML may not be properly sanitized; link hrefs not sanitized (`javascript:` URLs possible).
- **Fix**: Ensure DOMPurify runs before setting innerHTML; consider sandboxed iframe.

### M-8: Missing Input Validation on Auth Code/State Parameters
- **File**: `org/libs/auth/src/client.ts:25-28`
- **Issue**: No format/length validation on SSO `code` and `state` URL parameters.
- **Fix**: Validate against expected format regex; enforce max length.

### M-10: Environment Variable Handling — Env Vars in Browser
- **File**: `studio/src/lib/envCrypto.ts`
- **Issue**: Encrypted env vars loaded into `window.process.env` in browser context. Even encrypted, API keys in browser memory can be inspected.
- **Fix**: Keep secrets server-side; only expose non-sensitive config to the browser.

### M-11: TypeScript Strict Mode Disabled in Most Workspaces
- **Files**: All product app `tsconfig.json` files (15 of 19 workspaces)
- **Fix**: Gradually enable strict mode, starting with new code paths.

### M-12: Supabase Minimum Password Length Too Low
- **File**: `cloud/supabase/config.toml`
- **Issue**: Minimum password length set to 6 characters.
- **Fix**: Increase to at least 8 characters.

### M-13: Missing Unhandled Promise Rejection Handlers
- **Files**: `space/src/routes/index.tsx`, `com/src/lib/cloud.ts`
- **Issue**: Silent failures in critical paths like SSO auth.
- **Fix**: Add `.catch()` handlers and user-facing error states.

### M-14: CSRF State Validation Workaround
- **File**: `org/libs/auth/src/client.ts`
- **Issue**: Missing sessionStorage state treated as success (workaround for React StrictMode). Could allow CSRF bypass.
- **Fix**: Use per-state keyed entries with atomic check-and-remove.

---

## Low Findings

### L-1: No HTTP Method Validation on Most Endpoints
- **Files**: `update-space/index.ts` and others
- **Fix**: Add explicit method checks, returning 405 for unsupported methods.

### L-2: Inconsistent Error Response Format
- **Issue**: `stripe-webhook` uses `{ error: "..." }`, others use `{ error: { message: "..." } }`.
- **Fix**: Standardize on `{ error: { message: "..." } }` everywhere.

### L-3: Misleading 404 in exchange-sso-code
- **File**: `cloud/supabase/functions/exchange-sso-code/index.ts`
- **Fix**: Return 400 Bad Request for invalid codes, not 404.

### L-4: No Model ID Format Validation
- **File**: `cloud/supabase/functions/_shared/provider.ts`
- **Fix**: Validate `provider/model` pattern before passing to providers.

### L-5: No Input Length Validation on API Fields
- **Files**: `create-space`, `create-api-key`, `create-sso-code`, `exchange-sso-code`
- **Fix**: Add max length checks (e.g., 255 chars); return 400 if exceeded.

### L-6: CORS Allows All Origins (`*`)
- **File**: `cloud/supabase/functions/_shared/cors.ts`
- **Fix**: Restrict to known frontend origins for authenticated endpoints.

### L-7: Hardcoded Region Default "iad" in Multiple Places
- **Files**: `create-space`, `provision-computer`, `stripe-webhook`
- **Fix**: Use `Deno.env.get("FLY_REGION") ?? "iad"` from a single constant.

### L-8: Edge Function Timeout vs Provisioning Timeout Mismatch
- **File**: `cloud/supabase/functions/create-space/index.ts`
- **Fix**: Reduce `waitForState` timeout to 30s or move to background job.

### L-9: Mixed User Data Sources in exchange-sso-code
- **File**: `cloud/supabase/functions/exchange-sso-code/index.ts`
- **Fix**: Use only `sessionData.user`; throw if undefined.

### L-10: Missing Resource Cleanup on Error in Browser Sandbox
- **File**: `org/libs/core/src/plugins/function/sandbox.ts:149-251`
- **Fix**: Add try-finally blocks around iframe operations.

### L-11: Weak SSO State Entropy (128 bits)
- **File**: `org/libs/auth/src/client.ts:5-9`
- **Fix**: Increase to 32 bytes (256 bits).

### L-13: Missing React Error Boundaries
- **Files**: All frontend app root routes
- **Fix**: Add Error Boundary components to root layouts.

### L-14: Duplicated Auth Header Logic
- **Files**: `computer/src/routes/settings.tsx`, `computer/src/lib/runtime/use-tier-detection.ts`, `space/src/routes/$spaceSlug/admin/terminal.tsx`
- **Fix**: Extract shared utility function.

### L-15: Race Condition in Async State Updates
- **File**: `space/src/routes/index.tsx`
- **Fix**: Add cleanup function to `useEffect`; check mount status before state updates.

### L-16: Missing Content Security Policy Headers
- **Files**: All frontend apps
- **Fix**: Add CSP headers in Vite config or deployment config.

### L-17: Sensitive Data Exposure in Error Messages
- **Files**: Multiple error handlers across frontend apps
- **Fix**: Show user-friendly messages; log detailed errors to console/monitoring.

### L-18: Missing Token Refresh Logic
- **File**: `org/libs/auth/src/client.ts`
- **Fix**: Implement token refresh rotation; handle expiration gracefully.

### L-19: No Automated Dependency Update Tooling
- **Fix**: Add Dependabot or Renovate configuration.

### L-20: Missing `.env.example` Files for Most Apps
- **Issue**: Only `studio/`, `com/`, and `cloud/` have `.env.example`; 8 other apps do not.
- **Fix**: Add `.env.example` to all apps that use environment variables.

### L-21: No Artifact Retention Policy in CI/CD
- **File**: `.github/workflows/deploy.yml`
- **Fix**: Add `retention-days` parameter to upload-pages-artifact step.

---

## Informational

### I-1: Plugin Registry Pollution Risk
- **File**: `org/libs/core/src/plugins/function/FunctionPlugin.ts`
- `runToolCode` tool can be registered multiple times across prompt re-executions. Consider deduplication.

### I-2: Fire-and-Forget Async Patterns Undocumented
- **Files**: `create-space`, `provision-computer`
- Add comments explaining the pattern; add `.catch()` handlers.

### I-3: Stripe API Version Hardcoded in get-usage
- Use centralized version from `_shared/stripe.ts`.

### I-4: `notes.txt` Contains Informal Product Notes
- **File**: `notes.txt`
- Not a security concern but may be unintentional.

### I-5: Good Practices — Secrets Not Committed
- `.env` and `.env.local` properly gitignored. All `.env.example` files use placeholders only.

### I-6: Good Practices — Centralized Vite Config
- All 10 frontend apps import shared `createViteConfig()` — single point of change.

### I-7: Good Practices — Well-Designed Local Dev Infrastructure
- Idempotent nginx proxy with mkcert HTTPS, cross-platform support, proper cleanup.

---

## Recommended Remediation Priority

### Immediate (before next release)
1. **C-1**: Replace `new Function()` sandbox with Web Workers
2. **C-2**: Deprecate XOR encryption; migrate to AES-GCM
3. **C-3**: Remove empty-string fallback for token secrets
4. **C-4**: Enable JWT verification on protected endpoints
5. **H-1**: Fix open redirect in auth flows
6. **H-9**: Fix slug validation logic (`&&` → `||`)

### Short-term (next sprint)
7. **H-2**: Migrate tokens from localStorage to secure storage
8. **H-3**: Add JSON parse error handling on all endpoints
9. **H-6**: Fix CSRF state race condition
11. **H-11**: Pin `vite-plus` versions
12. **H-12**: Add lint/test steps to CI/CD

### Medium-term (next quarter)
13. Enable TypeScript strict mode incrementally (M-11)
14. Standardize error response formats (L-2, M-3)
15. Add input validation across all endpoints (L-5, M-8)
16. Implement CSP headers (L-16)
17. Add Error Boundaries to all apps (L-13)
18. Add Dependabot/Renovate (L-19)
