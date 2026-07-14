import { useEffect, useState } from 'react'
import { BASE } from './api.js'

/** A route parsed from the URL: list (`/scenario-dash/`) or detail (`/scenario-dash/scenarios/:id`). */
export interface Route {
  name: 'list' | 'detail'
  scenarioId?: string
}

export function parseRoute(): Route {
  const p = window.location.pathname.replace(/\/+$/, '')
  const detail = `${BASE}/scenarios/`
  if (p.startsWith(detail)) return { name: 'detail', scenarioId: decodeURIComponent(p.slice(detail.length)) }
  return { name: 'list' }
}

export function navigate(to: string) {
  window.history.pushState({}, '', to)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parseRoute())
  useEffect(() => {
    const onPop = () => setRoute(parseRoute())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  return route
}

export function detailHref(id: string) {
  return `${BASE}/scenarios/${encodeURIComponent(id)}`
}
