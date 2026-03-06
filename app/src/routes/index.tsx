import { createFileRoute } from '@tanstack/react-router'
import LandingLayout from '@/shell/LandingLayout'

export const Route = createFileRoute('/')({
  component: () => <LandingLayout />,
})
