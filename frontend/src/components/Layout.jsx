import { Outlet, NavLink, useNavigate } from 'react-router-dom'

export default function Layout() {
  const navigate = useNavigate()

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="brand-icon">⏱</span>
          <span className="brand-name">TimeTracker</span>
        </div>

        {/* Active timer indicator — will be driven by real state later */}
        <div className="topbar-timer running">
          <span className="timer-dot" />
          <span className="timer-label">Studying React</span>
          <span className="timer-elapsed">01:23:45</span>
          <button className="btn btn-stop btn-sm">Stop</button>
        </div>

        <nav className="topbar-nav">
          <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Dashboard</NavLink>
          <NavLink to="/projects"  className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Projects</NavLink>
          <NavLink to="/overview"  className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Overview</NavLink>
        </nav>

        <div className="topbar-user">
          <span className="user-avatar">AA</span>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/login')}>Logout</button>
        </div>
      </header>

      <main className="page-content">
        <Outlet />
      </main>
    </div>
  )
}
