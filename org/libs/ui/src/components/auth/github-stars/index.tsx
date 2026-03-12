import { useQuery } from '@tanstack/react-query'
import { Star } from 'lucide-react'
import { Caption } from '@lmthing/ui/elements/typography/caption'

interface GithubStarsProps {
  repo: string
}

interface GithubRepoData {
  stargazers_count: number
}

export function GithubStars({ repo }: GithubStarsProps) {
  const { data, isLoading, error } = useQuery<GithubRepoData>({
    queryKey: ['github-stars', repo],
    queryFn: async () => {
      const response = await fetch(`https://api.github.com/repos/${repo}`)
      if (!response.ok) throw new Error('Failed to fetch GitHub stars')
      return response.json()
    },
    staleTime: 1000 * 60 * 5,
    retry: 2,
  })

  if (error || isLoading) return null

  const stars = data?.stargazers_count ?? 0
  const formattedStars = stars >= 1000 ? `${(stars / 1000).toFixed(1)}k` : stars.toString()

  return (
    <a href={`https://github.com/${repo}`} target="_blank" rel="noopener noreferrer" className="badge">
      <Star className="size-4" />
      <span>{formattedStars}</span>
      <Caption muted>stars</Caption>
    </a>
  )
}
