import '@lmthing/css/components/computer/computer-layout.css'
import { Sidebar, SidebarItem } from '../../elements/nav/sidebar'
import { TopBar } from '../../elements/nav/top-bar'
import { Badge } from '../../elements/content/badge'
import type { RuntimeStatus, RuntimeTier } from './status-card'

export interface ComputerLayoutProps {
  status: RuntimeStatus
  tier: RuntimeTier
  currentPath: string
  onNavigate: (path: string) => void
  children: React.ReactNode
}

const navItems = [
  { path: '/', label: 'Dashboard' },
  { path: '/terminal', label: 'Terminal' },
  { path: '/spaces', label: 'Spaces' },
  { path: '/settings', label: 'Settings' },
]

function ComputerLayout({ status, tier, currentPath, onNavigate, children }: ComputerLayoutProps) {
  return (
    <div className="computer-layout">
      <Sidebar>
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
      </Sidebar>
      <div className="computer-layout__content">
        <TopBar
          title="lmthing.computer"
          actions={
            <>
              <Badge variant={status === 'running' ? 'success' : 'muted'}>{status}</Badge>
              <Badge variant={tier === 'flyio' ? 'primary' : 'muted'}>
                {tier === 'flyio' ? 'Computer' : 'Free'}
              </Badge>
            </>
          }
        />
        <div className="computer-layout__main">
          {children}
        </div>
      </div>
    </div>
  )
}

export { ComputerLayout }
