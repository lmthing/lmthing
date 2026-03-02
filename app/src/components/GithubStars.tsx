import { useQuery } from '@tanstack/react-query'
import { Star } from 'lucide-react'

interface GithubStarsProps {
  repo: string // Format: "owner/repo"
}

interface GithubRepoData {
  stargazers_count: number
}

export function GithubStars({ repo }: GithubStarsProps) {
  const { data, isLoading, error } = useQuery<GithubRepoData>({
    queryKey: ['github-stars', repo],
    queryFn: async () => {
      const response = await fetch(`https://api.github.com/repos/${repo}`)
      if (!response.ok) {
        throw new Error('Failed to fetch GitHub stars')
      }
      return response.json()
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    retry: 2,
  })

  if (error || isLoading) {
    return null
  }

  const stars = data?.stargazers_count ?? 0
  const formattedStars = stars >= 1000 ? `${(stars / 1000).toFixed(1)}k` : stars.toString()

  return (
    <a
      href={`https://github.com/${repo}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
    >
      <Star className="size-4 text-amber-500 fill-amber-500" />
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {formattedStars}
      </span>
      <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
        stars
      </span>
    </a>
  )
}
