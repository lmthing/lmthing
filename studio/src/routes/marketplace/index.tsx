import { createFileRoute } from '@tanstack/react-router'
import MarketplaceLayout from '@/shell/MarketplaceLayout'

export const Route = createFileRoute('/marketplace/')({
  component: () => <MarketplaceLayout />,
})
