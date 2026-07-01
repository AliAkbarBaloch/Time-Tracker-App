import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTimer } from '../context/TimerContext'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { activeTask, elapsed } = useTimer()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const initials = user?.displayName
    ? user.displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="brand-icon">⏱</span>
          <span className="brand-name">TimeTracker</span>
        </div>

        {activeTask && (
          <div className="topbar-timer running" data-testid="topbar-timer">
            <span className="timer-dot" />
            <span className="topbar-timer-desc" data-testid="topbar-timer-desc">
              {activeTask.description || 'Timer running'}
            </span>
            <span className="timer-elapsed" data-testid="topbar-elapsed">{elapsed}</span>
          </div>
        )}

        <nav className="topbar-nav">
          <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Dashboard</NavLink>
          <NavLink to="/tasks"     className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Tasks</NavLink>
          <NavLink to="/projects"  className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Projects</NavLink>
          <NavLink to="/overview"  className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Overview</NavLink>
        </nav>

        <div className="topbar-user">
          <span className="user-avatar" title={user?.displayName}>{initials}</span>
          <NavLink to="/settings" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Settings</NavLink>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <main className="page-content">
        <Outlet />
      </main>
    </div>
  )
}
