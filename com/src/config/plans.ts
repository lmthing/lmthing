export interface Plan {
  id: string
  name: string
  description: string
  priceId: string
  price: string
  period: string
  features: string[]
  highlighted?: boolean
}

export const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Get started with lmthing',
    priceId: '',
    price: '$0',
    period: 'forever',
    features: [
      'Bring your own API keys',
      'Local workspace',
      'Community agents',
      'Basic models',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For power users and creators',
    priceId: 'price_pro',
    price: '$20',
    period: 'per month',
    features: [
      'All free features',
      'Cloud workspace sync',
      'All models (GPT-4o, Claude, Gemini)',
      'API access with lmt_ keys',
      'Priority support',
    ],
    highlighted: true,
  },
  {
    id: 'team',
    name: 'Team',
    description: 'Collaborate with your team',
    priceId: 'price_team',
    price: '$50',
    period: 'per seat/month',
    features: [
      'All Pro features',
      'Team workspaces',
      'Shared agents and flows',
      'Admin controls',
      'SSO',
    ],
  },
]
