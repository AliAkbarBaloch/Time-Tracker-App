import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { changePassword, updateProfile } from '../api/authApi'

// Common IANA timezone identifiers shown in the timezone selector (US-025).
// The list covers the most-used zones globally; the user can also type ahead
// in most browsers to jump to a specific zone quickly.
const COMMON_TIMEZONES = [
  'UTC',
  'Europe/London',
  'Europe/Lisbon',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Athens',
  'Europe/Helsinki',
  'Europe/Istanbul',
  'Europe/Moscow',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Perth',
  'Australia/Adelaide',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Pacific/Auckland',
  'Pacific/Honolulu',
  'America/Anchorage',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Toronto',
  'America/Sao_Paulo',
  'America/Buenos_Aires',
]

export default function SettingsPage() {
  const { logout, user, updateUser } = useAuth()
  const navigate = useNavigate()

  // ── Change password ───────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword,     setNewPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwLoading,       setPwLoading]       = useState(false)
  const [pwError,         setPwError]         = useState('')
  const [pwSuccess,       setPwSuccess]       = useState(false)

  // ── Timezone selector (US-025) ────────────────────────────────────────────
  const [timezone,    setTimezone]    = useState(user?.timezone ?? 'UTC')
  const [tzLoading,   setTzLoading]   = useState(false)
  const [tzError,     setTzError]     = useState('')
  const [tzSuccess,   setTzSuccess]   = useState(false)

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    setPwError('')
    setPwSuccess(false)

    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match.')
      return
    }

    setPwLoading(true)
    try {
      await changePassword(currentPassword, newPassword)
      setPwSuccess(true)
      await logout()
      navigate('/login')
    } catch (err) {
      setPwError(err.response?.data?.message || 'Failed to change password.')
    } finally {
      setPwLoading(false)
    }
  }

  /**
   * Save the selected timezone via PUT /api/users/profile and update the
   * in-memory AuthContext so all pages immediately use the new zone.
   */
  const handleTimezoneSubmit = async (e) => {
    e.preventDefault()
    setTzError('')
    setTzSuccess(false)
    setTzLoading(true)
    try {
      await updateProfile(null, timezone)
      updateUser({ timezone })   // sync AuthContext + localStorage
      setTzSuccess(true)
    } catch (err) {
      setTzError(err.response?.data?.message || 'Failed to save timezone.')
    } finally {
      setTzLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Settings</h2>
      </div>

      {/* ── Timezone section (US-025) ─────────────────────────────────────── */}
      <div className="settings-card">
        <h3 className="settings-section-title">Preferred Time Zone</h3>
        <p className="settings-description">
          Choose how task times are displayed throughout the app.
          Stored times are always in UTC — only the display changes.
        </p>
        <form onSubmit={handleTimezoneSubmit} data-testid="timezone-form">
          <div className="form-group">
            <label htmlFor="timezone-select">Time Zone</label>
            <select
              id="timezone-select"
              className="form-input"
              value={timezone}
              onChange={e => { setTimezone(e.target.value); setTzSuccess(false) }}
              disabled={tzLoading}
              data-testid="timezone-select"
            >
              {COMMON_TIMEZONES.map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>

          {tzError   && <p className="form-error"   role="alert" data-testid="timezone-error">{tzError}</p>}
          {tzSuccess && <p className="form-success"  data-testid="timezone-success">Timezone saved.</p>}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={tzLoading}
            data-testid="timezone-submit-btn"
          >
            {tzLoading ? 'Saving…' : 'Save Timezone'}
          </button>
        </form>
      </div>

      {/* ── Change password section ───────────────────────────────────────── */}
      <div className="settings-card">
        <h3 className="settings-section-title">Change Password</h3>
        <form onSubmit={handlePasswordSubmit} data-testid="change-password-form">
          <div className="form-group">
            <label htmlFor="currentPassword">Current Password</label>
            <input
              id="currentPassword"
              type="password"
              className="form-input"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              required
              disabled={pwLoading}
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
              disabled={pwLoading}
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
              disabled={pwLoading}
              data-testid="confirm-password-input"
            />
          </div>

          {pwError && <p className="form-error" role="alert">{pwError}</p>}
          {pwSuccess && <p className="form-success">Password changed. Redirecting to login…</p>}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={pwLoading}
            data-testid="submit-btn"
          >
            {pwLoading ? 'Saving…' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
