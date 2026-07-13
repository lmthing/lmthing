// Adding a new tier? Update this file AND cloud/gateway/src/lib/tiers.ts + others.
// See org/docs/contributing/add-a-tier.md for the full checklist.

export interface Plan {
  id: string
  name: string
  description: string
  price: string
  period: string
  features: string[]
  highlighted?: boolean
}

// Everything here mirrors cloud/gateway/src/lib/tiers.ts — that file is the source of truth.
//
// Tiers differ ONLY by their budget windows (1d / 7d / 30d rolling spend caps; a request is
// rejected once ANY window is exhausted) and by compute-pod sizing. They do NOT differ by
// rate limit or model access: tiers.ts stamps every tier with the SAME tpmLimit (1,000,000)
// and rpmLimit (5,000), and the same model allowlist. So the rate limit is stated once,
// identically, on every plan rather than faked into a per-tier ladder.
//
// Models: all tiers get all five chat models (DeepSeek-V4-Flash, DeepSeek-V4-Pro, Kimi-K2.6,
// gpt-5.5, gpt-5.4-mini) plus whisper-1 for transcription — tiers.ts ENABLED_MODELS/TIER_MODELS.
export const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Get started with the API',
    price: '$0',
    period: 'forever',
    features: [
      'Budget: $10 / 1d · $50 / 7d · $150 / 30d',
      'All 5 models',
      '1M tokens/min, 5K req/min',
      'OpenAI-compatible API',
    ],
  },
  {
    id: 'basic',
    name: 'Basic',
    description: 'For side projects and prototyping',
    price: '$10',
    period: 'per month',
    features: [
      'Budget: $1 / 1d · $4 / 7d · $10 / 30d',
      'All 5 models',
      '1M tokens/min, 5K req/min',
      'Priority support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For production applications',
    price: '$20',
    period: 'per month',
    features: [
      'Budget: $3 / 1d · $10 / 7d · $20 / 30d',
      'All 5 models',
      '1M tokens/min, 5K req/min',
      'Priority support',
    ],
    highlighted: true,
  },
  {
    id: 'max',
    name: 'Max',
    description: 'For high-volume workloads',
    price: '$100',
    period: 'per month',
    features: [
      'Budget: $10 / 1d · $30 / 7d · $100 / 30d',
      'All 5 models',
      '1M tokens/min, 5K req/min',
      'Dedicated support',
    ],
  },
]
