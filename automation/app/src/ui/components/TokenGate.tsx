import { useState } from 'react'
import { setToken } from '../lib/api.js'

export function TokenGate({ onSet }: { onSet: () => void }) {
  const [val, setVal] = useState('')
  return (
    <div className="flex h-full items-center justify-center">
      <div className="bg-card border border-border rounded-lg p-8 w-full max-w-md">
        <h1 className="text-xl mb-2">scenario dashboard</h1>
        <p className="text-muted-foreground text-sm mb-4">
          Enter the shared secret (<code className="font-mono">DASH_VIEW_TOKEN</code>) to view.
        </p>
        <input
          className="w-full bg-input text-foreground border border-border rounded px-3 py-2 font-mono text-sm mb-3"
          type="password"
          value={val}
          placeholder="token"
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && val) {
              setToken(val)
              onSet()
            }
          }}
        />
        <button
          className="bg-primary text-primary-foreground rounded px-4 py-2 text-sm w-full disabled:opacity-50"
          disabled={!val}
          onClick={() => {
            setToken(val)
            onSet()
          }}
        >
          Unlock
        </button>
      </div>
    </div>
  )
}
