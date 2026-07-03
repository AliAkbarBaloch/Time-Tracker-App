import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { useTimer } from '../context/useTimer'
import { useTheme } from '../context/useTheme'

function Icon({ size = 16, children }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

const icons = {
  dashboard: (
    <Icon>
      <rect x="3" y="3" width="7" height="7" rx="1.5"/>
      <rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/>
      <rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </Icon>
  ),
  tasks: (
    <Icon>
      <path d="M9 11l3 3L22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </Icon>
  ),
  projects: (
    <Icon>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </Icon>
  ),
  overview: (
    <Icon>
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </Icon>
  ),
  analytics: (
    <Icon>
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </Icon>
  ),
  settings: (
    <Icon>
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </Icon>
  ),
  logout: (
    <Icon>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </Icon>
  ),
  clock: (
    <Icon size={18}>
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </Icon>
  ),
  sun: (
    <Icon size={13}>
      <circle cx="12" cy="12" r="4.5"/>
      <line x1="12" y1="2" x2="12" y2="4"/>
      <line x1="12" y1="20" x2="12" y2="22"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="2" y1="12" x2="4" y2="12"/>
      <line x1="20" y1="12" x2="22" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </Icon>
  ),
  moon: (
    <Icon size={13}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </Icon>
  ),
  monitor: (
    <Icon size={13}>
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </Icon>
  ),
  hamburger: (
    <Icon size={20}>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </Icon>
  ),
  x: (
    <Icon size={20}>
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </Icon>
  ),
}

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: icons.dashboard },
  { to: '/tasks',     label: 'Tasks',     icon: icons.tasks     },
  { to: '/projects',  label: 'Projects',  icon: icons.projects  },
  { to: '/overview',  label: 'Overview',  icon: icons.overview  },
  { to: '/analytics', label: 'Analytics', icon: icons.analytics },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { activeTask, elapsed } = useTimer()
  const { theme, setTheme } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const initials = user?.displayName
    ? user.displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : (user?.email?.[0] ?? '?').toUpperCase()

  return (
    <div className="app-shell">

      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay${sidebarOpen ? ' open' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>

        {/* Brand */}
        <div className="sidebar-brand">
          <div className="brand-logo">{icons.clock}</div>
          <span className="brand-name">TimeTracker</span>
        </div>

        {/* Primary nav */}
        <nav className="sidebar-nav">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Live timer — data-testid kept for test compatibility */}
        {activeTask && (
          <div className="sidebar-timer" data-testid="topbar-timer">
            <div className="sidebar-timer-inner">
              <div className="sidebar-timer-header">
                <span className="timer-pulse-dot" />
                <span className="sidebar-timer-label">Tracking</span>
              </div>
              <div className="sidebar-timer-desc" data-testid="topbar-timer-desc">
                {activeTask.description || 'Timer running'}
              </div>
              <div className="sidebar-timer-elapsed" data-testid="topbar-elapsed">{elapsed}</div>
            </div>
          </div>
        )}

        <div className="sidebar-spacer" />

        {/* Footer: settings + theme toggle + user */}
        <div className="sidebar-footer">
          <NavLink to="/settings" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <span className="nav-icon">{icons.settings}</span>
            Settings
          </NavLink>

          {/* Theme toggle — proper SVG icons */}
          <div className="theme-toggle" role="group" aria-label="Color theme">
            <button
              className={`theme-btn${theme === 'light' ? ' active' : ''}`}
              onClick={() => setTheme('light')}
              title="Light mode"
              aria-pressed={theme === 'light'}
            >
              {icons.sun}
              <span>Light</span>
            </button>
            <button
              className={`theme-btn${theme === 'dark' ? ' active' : ''}`}
              onClick={() => setTheme('dark')}
              title="Dark mode"
              aria-pressed={theme === 'dark'}
            >
              {icons.moon}
              <span>Dark</span>
            </button>
            <button
              className={`theme-btn${theme === 'system' ? ' active' : ''}`}
              onClick={() => setTheme('system')}
              title="Follow system preference"
              aria-pressed={theme === 'system'}
            >
              {icons.monitor}
              <span>Auto</span>
            </button>
          </div>

          <div className="sidebar-user">
            <div className="user-avatar" title={user?.displayName}>{initials}</div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user?.displayName || user?.email}</span>
              {user?.displayName && <span className="sidebar-user-email">{user.email}</span>}
            </div>
            <button
              className="sidebar-logout-btn"
              onClick={handleLogout}
              title="Logout"
              aria-label="Logout"
            >
              {icons.logout}
            </button>
          </div>
        </div>

      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginLeft: 'var(--sidebar-w)', minHeight: '100vh' }}>

        {/* Mobile top bar */}
        <div className="mobile-bar">
          <button
            className="hamburger-btn"
            onClick={() => setSidebarOpen(o => !o)}
            aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
          >
            {sidebarOpen ? icons.x : icons.hamburger}
          </button>
          <span className="mobile-brand">TimeTracker</span>
        </div>

        <main className="page-content" key={location.pathname}>
          <Outlet />
        </main>
      </div>

    </div>
  )
}
