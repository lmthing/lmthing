// Adding a new tier? Update this file AND cloud/gateway/src/lib/tiers.ts + others.
// See root CLAUDE.md § "Adding a New Tier" for the full checklist.

export interface Plan {
  id: string
  name: string
  description: string
  price: string
  period: string
  features: string[]
  highlighted?: boolean
}

// Budget windows (1d / 7d / 30d spend caps) mirror cloud/gateway/src/lib/tiers.ts.
// All tiers can call all four models (DeepSeek-V4-Flash, DeepSeek-V4-Pro, Kimi-K2.6, gpt-5.5).
export const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Get started with the API',
    price: '$0',
    period: 'forever',
    features: [
      'Budget: $0.30 / 1d · $2 / 7d · $6 / 30d',
      'All 4 models',
      '10K tokens/min, 60 req/min',
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
      'All 4 models',
      '50K tokens/min, 300 req/min',
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
      'All 4 models',
      '100K tokens/min, 1K req/min',
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
      'All 4 models',
      '1M tokens/min, 5K req/min',
      'Dedicated support',
    ],
  },
]
