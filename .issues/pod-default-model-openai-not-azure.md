# User compute pods default `LM_MODEL` to `openai:…` (litellm), not Azure DeepSeek

Observed 2026-06-28. A freshly-provisioned user pod's `user-env` secret sets:

```
LM_MODEL=openai:gpt-5.4-nano
OPENAI_BASE_URL=http://litellm.lmthing.svc.cluster.local:4000/v1
OPENAI_API_KEY=<litellm key>
```

So the default model the agent runs is **`openai:gpt-5.4-nano` via the LiteLLM
proxy** — but the project only uses **Azure DeepSeek** models
(`sdk/org/.env`: `LM_MODEL_*=azure:DeepSeek-V4-{Flash,Pro}` / `azure:Kimi-K2.6`).
The THING agent therefore boots on the wrong provider+model (`openai/gpt`), which
is "completely wrong" for this deployment.

Where it's set: `cloud/gateway/src/lib/compute.ts` writes the `user-env` secret
(`OPENAI_BASE_URL`, `OPENAI_API_KEY`, `LM_MODEL`) when creating the pod.

## Impact
- New users (and the QA test user) run on a model the project doesn't intend.
- Combined with the per-role aliases that ARE azure DeepSeek, the *default*
  `LM_MODEL` is the odd one out, so freeform THING turns use openai/gpt while
  forks/delegates use azure — inconsistent.
- Likely contributor to the observed architect synthesize-stall, since the
  stalled stream was on the default model.

## Workaround used this session
Manually `PUT /api/compute/env` for the test user with **azure-only** vars from
`sdk/org/.env` plus `LM_MODEL=azure:DeepSeek-V4-Pro`, and dropped
`OPENAI_API_KEY` / `OPENAI_BASE_URL` entirely.

## To fix (open)
- Decide the intended default: if the platform bills through LiteLLM, the
  LiteLLM config should map a DeepSeek model and `LM_MODEL` should point at it
  (e.g. `LM_MODEL` aligned with the `LM_MODEL_*` azure DeepSeek aliases), NOT
  `openai:gpt-5.4-nano`.
- Provision `LM_MODEL` (and the `LM_MODEL_*` aliases) consistently in
  `compute.ts` so the default provider matches the per-role models.
- If direct-Azure is intended for some tiers, provision `AZURE_API_KEY` +
  `AZURE_RESOURCE_NAME` instead of the OpenAI/litellm vars.
