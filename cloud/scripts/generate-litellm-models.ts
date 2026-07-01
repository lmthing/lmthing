/**
 * Generate the LiteLLM `model_list` block for the enabled lmthing.cloud models,
 * applying the 15% gateway markup to the base Azure prices.
 *
 * Base prices come from sdk/org/libs/cli/prices/azure.json (per-1K tokens, produced by
 * `pnpm fetch-azure-prices` in libs/cli). LiteLLM wants per-token costs, so:
 *
 *   input_cost_per_token = inputPer1K / 1000 * MARKUP
 *
 * Paste the printed block into the `model_list:` of devops/argocd/core/litellm.yaml
 * (this mirrors the "print values to paste" pattern of create-stripe-products.ts, so
 * the ArgoCD-managed YAML stays the source of truth while markup stays deterministic).
 *
 * Usage:
 *   npx tsx scripts/generate-litellm-models.ts
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Gateway markup over provider (Azure) cost. Keep in sync with cloud/CLAUDE.md. */
const MARKUP = 1.15;

const PRICES_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../sdk/org/libs/cli/prices/azure.json',
);

/** Models exposed by the provider — must match gateway ENABLED_MODELS + tiers.ts. */
const ENABLED_MODELS = ['DeepSeek-V4-Flash', 'DeepSeek-V4-Pro', 'Kimi-K2.6', 'gpt-5.5'];

const API_VERSION = '2024-12-01-preview';

interface ModelPricing {
  inputPer1K: number;
  outputPer1K: number;
  /** Optional cached-input (prompt cache read) price per 1K tokens. */
  cachedInputPer1K?: number;
}

/** per-1K base → per-token with markup, as a plain (non-exponential) decimal string. */
function perToken(per1K: number): string {
  const v = (per1K / 1000) * MARKUP;
  // 6 significant digits, then render without scientific notation (LiteLLM/YAML style).
  const sig = Number(v.toPrecision(6));
  // toFixed(20) then strip trailing zeros → avoids "2.185e-7" for tiny per-token costs.
  return sig.toFixed(20).replace(/0+$/, '').replace(/\.$/, '');
}

function main() {
  const prices: Record<string, ModelPricing> = JSON.parse(readFileSync(PRICES_PATH, 'utf8'));

  const lines: string[] = ['model_list:'];
  const missing: string[] = [];

  for (const model of ENABLED_MODELS) {
    const p = prices[model];
    if (!p) {
      missing.push(model);
      continue;
    }
    lines.push(
      `  - model_name: ${model}`,
      `    litellm_params:`,
      `      model: azure/${model}`,
      `      api_base: os.environ/AZURE_API_BASE`,
      `      api_key: os.environ/AZURE_API_KEY`,
      `      api_version: "${API_VERSION}"`,
      `    model_info:`,
      `      # 15% markup over Azure base price (azure_per_1K / 1000 * ${MARKUP})`,
      `      input_cost_per_token: ${perToken(p.inputPer1K)}`,
      `      output_cost_per_token: ${perToken(p.outputPer1K)}`,
    );
    if (typeof p.cachedInputPer1K === 'number') {
      lines.push(`      cache_read_input_token_cost: ${perToken(p.cachedInputPer1K)}`);
    }
  }

  console.log(lines.join('\n'));

  if (missing.length) {
    console.error(
      `\n⚠️  Missing from ${PRICES_PATH}: ${missing.join(', ')}. ` +
        `Run \`pnpm fetch-azure-prices\` in sdk/org/libs/cli first.`,
    );
    process.exit(1);
  }
}

main();
