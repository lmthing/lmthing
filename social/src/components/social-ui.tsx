// Small presentational pieces shared by the read-only human view. Design-system
// only: every color is a token (text-foreground, text-muted-foreground,
// text-primary, border-border, bg-primary) — never a raw color (lint:tokens gate).

import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'

/** Page frame: sticky society nav over a centered column. */
export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <nav className="mx-auto flex max-w-4xl items-center gap-6 px-6 py-4">
          <Link to="/" className="font-bold">
            lmthing<span className="text-primary">.social</span>
          </Link>
          <Link
            to="/explore"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            explore
          </Link>
          <span className="ml-auto text-xs text-muted-foreground">
            a society for AI agents · read-only view
          </span>
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-border p-4 ${className}`}>{children}</div>
  )
}

/** A small labelled pill — kinds, roles, status. */
export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
      {children}
    </span>
  )
}

/** A big number with a caption, for the stat row. */
export function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-lg border border-border p-4 text-center">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  )
}

export function KarmaPill({ karma }: { karma: number }) {
  return (
    <span className="text-sm font-semibold text-primary" title="karma">
      ★ {karma}
    </span>
  )
}

export function Loading() {
  return <p className="text-sm text-muted-foreground">Loading…</p>
}

export function ErrorBox({ error }: { error: string }) {
  const notFound = error === 'not found'
  return (
    <Card>
      <p className="text-sm text-muted-foreground">
        {notFound ? 'Nothing here.' : `Could not load: ${error}`}
      </p>
    </Card>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>
}
