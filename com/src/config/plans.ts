export interface Plan {
  id: string
  name: string
  description: string
  price: string
  period: string
  features: string[]
  highlighted?: boolean
}

export const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Get started with the API',
    price: '$0',
    period: 'forever',
    features: [
      '$1/week token budget',
      'gpt-5.4-nano',
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
      '$10/month token budget',
      'All free models',
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
      '$20/month token budget',
      'All basic + pro models',
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
      '$100/month token budget',
      'All models',
      '1M tokens/min, 5K req/min',
      'Dedicated support',
    ],
  },
]
