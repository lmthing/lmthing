import { useEffect, useState } from 'react'
import { getToken, setToken } from '../lib/api.js'
import { useRoute } from '../lib/router.js'
import { TokenGate } from './TokenGate.js'
import { ScenarioList } from './ScenarioList.js'
import { ScenarioDetail } from './ScenarioDetail.js'

export function App() {
  const [hasToken, setHasToken] = useState(!!getToken())
  const route = useRoute()

  // Re-mirror the stored token into the cookie on boot: a user who unlocked before
  // the cookie was introduced has it in localStorage only, so the served-app iframe
  // would 401 until they re-enter it.
  useEffect(() => {
    if (getToken()) setToken(getToken())
  }, [])

  useEffect(() => {
    if (!hasToken) setHasToken(!!getToken())
  })

  if (!hasToken) return <TokenGate onSet={() => setHasToken(true)} />

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center gap-3">
          <a href="./" className="font-semibold">
            lmthing scenarios
          </a>
          <span className="text-muted-foreground text-sm">campaign dashboard</span>
          <button
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setToken('')
              location.reload()
            }}
          >
            lock
          </button>
        </div>
      </header>
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 py-4">
        {route.name === 'list' && <ScenarioList />}
        {route.name === 'detail' && route.scenarioId && <ScenarioDetail id={route.scenarioId} />}
      </main>
    </div>
  )
}
