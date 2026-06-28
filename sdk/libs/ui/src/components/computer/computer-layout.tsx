import '@lmthing/css/components/computer/computer-layout.css'
import { CozyThingText } from '../../elements/branding/cozy-text'
import { Sidebar, SidebarItem } from '../../elements/nav/sidebar'
import { TopBar } from '../../elements/nav/top-bar'
import { Badge } from '../../elements/content/badge'
import { otherAppLinks } from '../../lib/app-urls'
import { ConnectionBanner } from './connection-banner'
import type { RuntimeStatus, RuntimeTier } from './status-card'

export interface ComputerLayoutProps {
  status: RuntimeStatus
  tier: RuntimeTier
  currentPath: string
  onNavigate: (path: string) => void
  error?: string | null
  onRetry?: () => void
  onRestart?: () => void
  restarting?: boolean
  children: React.ReactNode
}

const navItems = [
  { path: '/', label: 'Dashboard' },
  { path: '/terminal', label: 'Terminal' },
  { path: '/spaces', label: 'Spaces' },
  { path: '/settings', label: 'Settings' },
]

function ComputerLayout({ status, tier, currentPath, onNavigate, error, onRetry, onRestart, restarting, children }: ComputerLayoutProps) {
  const connectionState = status === 'error' ? 'error' as const
    : status === 'booting' ? 'booting' as const
    : 'connected' as const

  return (
    <div className="computer-layout">
      <Sidebar style={{ justifyContent: 'space-between' }}>
        <div>
          {navItems.map((item) => (
            <SidebarItem
              key={item.path}
              active={currentPath === item.path}
              onClick={() => onNavigate(item.path)}
              style={{ cursor: 'pointer' }}
            >
              {item.label}
            </SidebarItem>
          ))}
        </div>
        <div>
          {otherAppLinks('computer').map((link) => (
            <a
              key={link.app}
              href={link.url}
              className="sidebar__item"
              title={`Open lmthing.${link.app}`}
              style={{ display: 'block', textDecoration: 'none' }}
            >
              {link.emoji} {link.label}
            </a>
          ))}
          {onRestart && (
            <SidebarItem
              onClick={restarting ? undefined : onRestart}
              style={{ cursor: restarting ? 'default' : 'pointer', opacity: restarting ? 0.5 : 1 }}
              title="Restart CLI process (reloads .env)"
            >
              {restarting ? '↻ Restarting…' : '⏻ Restart'}
            </SidebarItem>
          )}
        </div>
      </Sidebar>
      <div className="computer-layout__content">
        <TopBar
          title={<CozyThingText text="lmthing.computer" />}
          actions={
            <>
              <Badge variant={status === 'running' ? 'success' : 'muted'}>{status}</Badge>
              <Badge variant={tier === 'flyio' ? 'primary' : 'muted'}>
                {tier === 'flyio' ? 'Computer' : 'Free'}
              </Badge>
            </>
          }
        />
        <ConnectionBanner
          state={connectionState}
          error={error}
          onRetry={onRetry}
        />
        <div className="computer-layout__main">
          {children}
        </div>
      </div>
    </div>
  )
}

export { ComputerLayout }
