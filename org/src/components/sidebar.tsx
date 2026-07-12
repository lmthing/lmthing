import type { ReactNode } from 'react'
import { useState } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import { navTree, type NavNode } from '@/lib/docs'

// Doc routes live on the splat route, so a permissive Link avoids the typed
// route union while keeping SPA navigation.
const NavLink = Link as unknown as (props: {
  to: string
  className?: string
  onClick?: () => void
  children?: ReactNode
}) => ReactNode

function subtreeActive(node: NavNode, pathname: string): boolean {
  if (node.route && (pathname === node.route || pathname.startsWith(node.route + '/'))) return true
  return node.children.some((c) => subtreeActive(c, pathname))
}

interface TreeProps {
  nodes: NavNode[]
  depth: number
  pathname: string
  overrides: Record<string, boolean>
  toggle: (id: string, current: boolean) => void
  onNavigate: () => void
  parentId: string
}

function Tree({ nodes, depth, pathname, overrides, toggle, onNavigate, parentId }: TreeProps) {
  return (
    <ul className="flex flex-col gap-0.5">
      {nodes.map((node) => {
        const id = parentId ? `${parentId}/${node.key}` : node.key
        const hasChildren = node.children.length > 0
        const active = !!node.route && pathname === node.route
        const open = overrides[id] ?? subtreeActive(node, pathname)
        const indent = { paddingLeft: `${0.5 + depth * 0.75}rem` }

        if (!hasChildren) {
          return (
            <li key={id}>
              <NavLink
                to={node.route ?? '/'}
                onClick={onNavigate}
                className={clsx(
                  'block rounded-md py-1.5 pr-2 text-sm transition-colors',
                  active
                    ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                )}
              >
                <span style={indent} className="block">
                  {node.title}
                </span>
              </NavLink>
            </li>
          )
        }

        return (
          <li key={id}>
            <div
              className={clsx(
                'flex items-center rounded-md text-sm transition-colors',
                active
                  ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50',
              )}
              style={indent}
            >
              <button
                type="button"
                onClick={() => toggle(id, open)}
                aria-label={open ? `Collapse ${node.title}` : `Expand ${node.title}`}
                aria-expanded={open}
                className="flex h-7 w-6 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <ChevronRight
                  className={clsx('h-3.5 w-3.5 transition-transform', open && 'rotate-90')}
                  strokeWidth={2}
                />
              </button>
              {node.route ? (
                <NavLink
                  to={node.route}
                  onClick={onNavigate}
                  className="flex-1 truncate py-1.5 pr-2 font-medium"
                >
                  {node.title}
                </NavLink>
              ) : (
                <button
                  type="button"
                  onClick={() => toggle(id, open)}
                  className="flex-1 truncate py-1.5 pr-2 text-left font-medium"
                >
                  {node.title}
                </button>
              )}
            </div>
            {open && (
              <div className="mt-0.5">
                <Tree
                  nodes={node.children}
                  depth={depth + 1}
                  pathname={pathname}
                  overrides={overrides}
                  toggle={toggle}
                  onNavigate={onNavigate}
                  parentId={id}
                />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const toggle = (id: string, current: boolean) =>
    setOverrides((prev) => ({ ...prev, [id]: !current }))

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-background/70 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 w-72 overflow-y-auto border-r border-sidebar-border bg-sidebar transition-transform',
          'lg:sticky lg:top-14 lg:z-0 lg:h-[calc(100vh-3.5rem)] lg:translate-x-0 lg:transition-none',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <nav className="p-3">
          <Tree
            nodes={navTree.children}
            depth={0}
            pathname={pathname}
            overrides={overrides}
            toggle={toggle}
            onNavigate={onClose}
            parentId=""
          />
        </nav>
      </aside>
    </>
  )
}
