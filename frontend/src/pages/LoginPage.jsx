import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

export default function LoginPage() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const { register, login } = useAuth()
  const navigate = useNavigate()

  function switchMode(next) {
    setMode(next)
    setError('')
    setFieldErrors({})
    setConfirmPassword('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setFieldErrors({})

    if (mode === 'register') {
      const errs = {}
      if (!displayName.trim()) errs.displayName = 'Display name is required.'
      if (!email.trim()) errs.email = 'Email is required.'
      if (!password) errs.password = 'Password is required.'
      else if (password.length < 8) errs.password = 'Password must be at least 8 characters.'
      if (password && password !== confirmPassword) errs.confirmPassword = 'Passwords do not match.'
      if (Object.keys(errs).length > 0) {
        setFieldErrors(errs)
        return
      }
    }

    if (mode === 'login') {
      const errs = {}
      if (!email.trim()) errs.email = 'Email is required.'
      if (!password) errs.password = 'Password is required.'
      if (Object.keys(errs).length > 0) {
        setFieldErrors(errs)
        return
      }
    }

    setLoading(true)
    try {
      if (mode === 'register') {
        await register(email, password, displayName)
      } else {
        await login(email, password)
      }
      navigate('/dashboard')
    } catch (err) {
      const errors = err.response?.data?.errors
      if (errors && Object.keys(errors).length > 0) {
        setFieldErrors(errors)
      } else {
        setError(err.response?.data?.message || 'Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
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
            onClick={() => switchMode('login')}
          >Log In</button>
          <button
            className={`tab-btn ${mode === 'register' ? 'active' : ''}`}
            onClick={() => switchMode('register')}
          >Register</button>
        </div>

        {error && <p className="auth-error" role="alert">{error}</p>}

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="form-group">
              <label htmlFor="displayName">Display Name</label>
              <input
                id="displayName"
                type="text"
                placeholder="Ali Akbar"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className={fieldErrors.displayName ? 'input-error' : ''}
              />
              {fieldErrors.displayName && (
                <p className="field-error" role="alert" data-testid="error-displayName">{fieldErrors.displayName}</p>
              )}
            </div>
          )}
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className={fieldErrors.email ? 'input-error' : ''}
            />
            {fieldErrors.email && (
              <p className="field-error" role="alert" data-testid="error-email">{fieldErrors.email}</p>
            )}
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className={fieldErrors.password ? 'input-error' : ''}
            />
            {fieldErrors.password && (
              <p className="field-error" role="alert" data-testid="error-password">{fieldErrors.password}</p>
            )}
          </div>
          {mode === 'register' && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className={fieldErrors.confirmPassword ? 'input-error' : ''}
                data-testid="confirm-password-input"
              />
              {fieldErrors.confirmPassword && (
                <p className="field-error" role="alert" data-testid="error-confirmPassword">{fieldErrors.confirmPassword}</p>
              )}
            </div>
          )}
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Log In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  )
}
