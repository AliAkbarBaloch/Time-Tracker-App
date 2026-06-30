import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function LoginPage() {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const navigate = useNavigate()

  const handleSubmit = (e) => {
    e.preventDefault()
    // Skeleton: navigate to dashboard without real auth
    navigate('/dashboard')
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <span className="brand-icon-lg">⏱</span>
          <h1 className="auth-title">TimeTracker</h1>
          <p className="auth-subtitle">Track your time. Own your day.</p>
        </div>

        <div className="tab-bar">
          <button
            className={`tab-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => setMode('login')}
          >Log In</button>
          <button
            className={`tab-btn ${mode === 'register' ? 'active' : ''}`}
            onClick={() => setMode('register')}
          >Register</button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="form-group">
              <label htmlFor="displayName">Display Name</label>
              <input id="displayName" type="text" placeholder="Ali Akbar" required />
            </div>
          )}
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" placeholder="you@example.com" required />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" placeholder="••••••••" required />
          </div>
          {mode === 'register' && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input id="confirmPassword" type="password" placeholder="••••••••" required />
            </div>
          )}
          <button type="submit" className="btn btn-primary btn-full">
            {mode === 'login' ? 'Log In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  )
}
