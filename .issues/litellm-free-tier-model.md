# LiteLLM free-tier model wiring incomplete

Per-user compute pods can talk to a model in two ways:

1. **Custom env** — the user pastes their own `.env` (provider keys + `LM_MODEL`)
   via the in-app Env settings tab → `PUT /api/env` writes `/data/.env`, and the
   server applies it at startup (`bin.ts loadEnv` + `serve.ts` override). This
   path **works today** and is how the deployment was verified end-to-end (Azure).

2. **Free credits via LiteLLM** — the intended default for users who don't bring
   their own key: the gateway provisions a LiteLLM key and injects
   `OPENAI_BASE_URL` / `OPENAI_API_KEY` / `LM_MODEL=openai:<deepseek model>` into
   the pod (`gateway/src/lib/compute.ts: getLiteLLMKey` + `injectLiteLLMEnv`),
   backed by Azure credits, gated by tier budget.

**Path 2 is not working / deferred.** Symptoms observed in prod:
- The user pod has no `OPENAI_*` / `LM_MODEL` container env (the `injectLiteLLMEnv`
  call in `ensureUserPod` is failing and being swallowed by its try/catch), so a
  free-tier user with no custom `.env` has no usable model.
- LiteLLM model config still has `deepseek` / `deepseek-flash` placeholders
  (`azure/REPLACE_ME_*` in `devops/argocd/core/litellm.yaml`).

## To resolve

- Finish LiteLLM model config (real Azure deployment names for deepseek +
  deepseek-flash) and master key wiring.
- Make `getLiteLLMKey`/`injectLiteLLMEnv` succeed (create/fetch a per-user key
  with a stable alias; don't generate a fresh key each `ensure`, or the env
  changes every call and the pod restarts).
- Confirm `LM_MODEL=openai:<model>` + `OPENAI_BASE_URL=https://lmthing.cloud/v1`
  routes through LiteLLM with budget enforcement.
- Decide precedence: a user's custom `.env` should override the free-tier
  LiteLLM env (current startup-apply makes the file win — keep that).

## Related

- Free tier `maxSessions` was raised 1 → 3 so "+ New chat" works
  (`gateway/src/lib/tiers.ts`); pod env `MAX_SESSIONS` is set by `ensureUserPod`.
