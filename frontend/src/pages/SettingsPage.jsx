import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { changePassword } from '../api/authApi'

export default function SettingsPage() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading]                 = useState(false)
  const [error, setError]                     = useState('')
  const [success, setSuccess]                 = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await changePassword(currentPassword, newPassword)
      setSuccess(true)
      await logout()
      navigate('/login')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Settings</h2>
      </div>

      <div className="settings-card">
        <h3 className="settings-section-title">Change Password</h3>
        <form onSubmit={handleSubmit} data-testid="change-password-form">
          <div className="form-group">
            <label htmlFor="currentPassword">Current Password</label>
            <input
              id="currentPassword"
              type="password"
              className="form-input"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              required
              disabled={loading}
              data-testid="current-password-input"
            />
          </div>
          <div className="form-group">
            <label htmlFor="newPassword">New Password</label>
            <input
              id="newPassword"
              type="password"
              className="form-input"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              disabled={loading}
              data-testid="new-password-input"
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm New Password</label>
            <input
              id="confirmPassword"
              type="password"
              className="form-input"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
              data-testid="confirm-password-input"
            />
          </div>

          {error && <p className="form-error" role="alert">{error}</p>}
          {success && <p className="form-success">Password changed. Redirecting to login…</p>}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            data-testid="submit-btn"
          >
            {loading ? 'Saving…' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
