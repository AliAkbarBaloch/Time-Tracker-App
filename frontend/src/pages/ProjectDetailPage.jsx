import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import * as projectApi from '../api/projectApi'
import { formatInZone, todayInTz, localDateToUtcIso } from '../utils/dateUtils'

const PRESETS = [
  { key: 'all-time',   label: 'All Time' },
  { key: 'today',      label: 'Today' },
  { key: 'this-week',  label: 'This Week' },
  { key: 'this-month', label: 'This Month' },
  { key: 'custom',     label: 'Custom' },
]

function getPresetRange(preset, tz) {
  const { year, month, day } = todayInTz(tz)
  switch (preset) {
    case 'today': {
      return {
        from: localDateToUtcIso(year, month, day, 0, 0, 0, tz),
        to:   localDateToUtcIso(year, month, day + 1, 0, 0, 0, tz),
      }
    }
    case 'this-week': {
      // Monday of current week in user's timezone
      const todayUtc = new Date(Date.UTC(year, month - 1, day))
      const dow = todayUtc.getUTCDay() // 0=Sun
      const mondayDiff = dow === 0 ? -6 : 1 - dow
      const monD = new Date(Date.UTC(year, month - 1, day + mondayDiff))
      const nextMonD = new Date(Date.UTC(monD.getUTCFullYear(), monD.getUTCMonth(), monD.getUTCDate() + 7))
      return {
        from: localDateToUtcIso(monD.getUTCFullYear(), monD.getUTCMonth() + 1, monD.getUTCDate(), 0, 0, 0, tz),
        to:   localDateToUtcIso(nextMonD.getUTCFullYear(), nextMonD.getUTCMonth() + 1, nextMonD.getUTCDate(), 0, 0, 0, tz),
      }
    }
    case 'this-month': {
      // month is 1-indexed; Date.UTC(year, month, 1) treats month as 0-indexed → next month
      const nextFirst = new Date(Date.UTC(year, month, 1))
      const ny = nextFirst.getUTCFullYear()
      const nm = nextFirst.getUTCMonth() + 1 // back to 1-indexed
      return {
        from: localDateToUtcIso(year, month, 1, 0, 0, 0, tz),
        to:   localDateToUtcIso(ny, nm, 1, 0, 0, 0, tz),
      }
    }
    default:
      return { from: null, to: null }
  }
}

function formatSeconds(secs) {
  if (!secs) return '0m'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}


function ProjectTasksSection({ tasks, contributions, projectId, tz }) {
  const isShared = contributions && contributions.length > 1

  // Group tasks by description — multiple template sessions with the same name collapse into one row
  const groupedTasks = useMemo(() => {
    const groups = new Map()
    const sorted = [...tasks].sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
    for (const task of sorted) {
      const key = (task.description ?? '__no_desc__') + (isShared ? `__${task.userName ?? ''}` : '')
      if (!groups.has(key)) {
        groups.set(key, {
          description: task.description,
          latestTask: task,
          totalSeconds: 0,
          isRunning: false,
          ids: [],
        })
      }
      const group = groups.get(key)
      group.ids.push(task.id)
      if (!task.endTime) {
        group.isRunning = true
      } else {
        const secs = Math.floor((new Date(task.endTime) - new Date(task.startTime)) / 1000)
        if (secs > 0) group.totalSeconds += secs
      }
    }
    return [...groups.values()]
  }, [tasks, isShared])

  return (
    <div className="section" data-testid="tasks-section">
      <div className="section-header">
        <h3>Tasks</h3>
        <span className="muted">{groupedTasks.length} task{groupedTasks.length !== 1 ? 's' : ''}</span>
        <Link
          className="btn btn-primary btn-sm"
          to={`/tasks?projectId=${projectId}&addTask=true`}
          data-testid="add-task-to-project-btn">
          + Add Task
        </Link>
      </div>
      {tasks.length === 0 ? (
        <p className="empty-state" data-testid="empty-tasks">
          No tasks in this period.
        </p>
      ) : (
        <ul className="summary-list">
          {groupedTasks.map(group => {
            const t = group.latestTask
            const isSingle = group.ids.length === 1
            const durationText = group.isRunning
              ? '(running)'
              : formatSeconds(group.totalSeconds)
            return (
              <li key={group.ids.join('-')}
                className="summary-list-item"
                data-testid={isSingle ? `summary-task-${t.id}` : `summary-task-group-${t.id}`}>
                <span className="summary-item-name">{group.description || '(no description)'}</span>
                {isShared && t.userName && (
                  <span className="muted task-owner" data-testid={`task-owner-${t.id}`}>
                    {t.userName}
                  </span>
                )}
                <span className="summary-item-time muted">
                  {formatInZone(t.startTime, tz, { dateStyle: 'short' })}
                </span>
                <span className="summary-item-total"
                  data-testid={isSingle ? `summary-task-duration-${t.id}` : `summary-task-group-duration-${t.id}`}>
                  {durationText}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default function ProjectDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const tz = currentUser?.timezone ?? 'UTC'

  const [preset, setPreset]               = useState('all-time')
  const [customFrom, setCustomFrom]       = useState('')
  const [customTo, setCustomTo]           = useState('')
  const [summary, setSummary]             = useState(null)
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')
  // US-023: optional per-user filter; null = show all users
  const [selectedUserId, setSelectedUserId] = useState(null)

  // ── US-024: Export modal state ────────────────────────────────────────────
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportFormat,    setExportFormat]    = useState('csv')
  const [exportScope,     setExportScope]     = useState('all')   // 'all' | 'month'
  const [exportYear,      setExportYear]      = useState(new Date().getFullYear())
  const [exportMonth,     setExportMonth]     = useState(new Date().getMonth() + 1)
  const [exportLoading,   setExportLoading]   = useState(false)
  const [exportError,     setExportError]     = useState('')

  // ── US-022: Members section state ─────────────────────────────────────────
  const [members, setMembers]           = useState([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [inviteEmail, setInviteEmail]   = useState('')
  const [inviteError, setInviteError]   = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)

  const fetchSummary = useCallback(() => {
    let from = null
    let to   = null

    if (preset === 'custom') {
      from = customFrom ? new Date(customFrom).toISOString() : null
      to   = customTo   ? new Date(customTo + 'T23:59:59').toISOString() : null
    } else {
      const range = getPresetRange(preset, tz)
      from = range.from
      to   = range.to
    }

    setLoading(true)
    setError('')
    // Pass selectedUserId for per-user filtering (US-023); null = all users
    projectApi.getProjectSummary(id, from, to, selectedUserId)
      .then(res => setSummary(res.data))
      .catch(err => {
        if (err.response?.status === 404) {
          setError('Project not found.')
        } else {
          setError('Failed to load project summary.')
        }
      })
      .finally(() => setLoading(false))
  }, [id, preset, customFrom, customTo, selectedUserId, tz])

  useEffect(() => {
    if (preset !== 'custom') {
      fetchSummary()
    }
  }, [preset, fetchSummary])

  // Fetch members list on mount; re-fetch after invite/remove actions
  const fetchMembers = useCallback(() => {
    setMembersLoading(true)
    projectApi.getMembers(id)
      .then(res => setMembers(res.data))
      .catch(() => setMembers([]))
      .finally(() => setMembersLoading(false))
  }, [id])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  // Determine if the current user is the project OWNER (shows invite form + remove buttons)
  const isOwner = members.some(m => m.email === currentUser?.email && m.role === 'OWNER')

  const handleInvite = async (e) => {
    e.preventDefault()
    setInviteError('')
    setInviteLoading(true)
    try {
      await projectApi.inviteMember(id, inviteEmail)
      setInviteEmail('')
      fetchMembers()
    } catch (err) {
      const data = err.response?.data
      setInviteError(data?.message || 'Failed to invite member.')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleRemoveMember = async (userId) => {
    try {
      await projectApi.removeMember(id, userId)
      fetchMembers()
    } catch (err) {
      const data = err.response?.data
      alert(data?.message || 'Failed to remove member.')
    }
  }

  const handleCustomApply = (e) => {
    e.preventDefault()
    fetchSummary()
  }

  // ── US-024: Export handler ─────────────────────────────────────────────────

  /**
   * Call the export API, receive a Blob, create a temporary object URL,
   * trigger a browser download via a hidden <a> element, then revoke the URL.
   * This pattern avoids embedding the JWT token in the URL.
   */
  const handleExport = async (e) => {
    e.preventDefault()
    setExportLoading(true)
    setExportError('')
    try {
      const year  = exportScope === 'month' ? exportYear  : null
      const month = exportScope === 'month' ? exportMonth : null
      const res   = await projectApi.exportProject(id, exportFormat, null, null, year, month)
      const ext   = exportFormat === 'json' ? 'json' : 'csv'
      const url   = URL.createObjectURL(res.data)
      const a     = document.createElement('a')
      a.href     = url
      a.download = `${(summary?.name ?? id).replace(/[^a-zA-Z0-9-_]/g, '_')}-export.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setShowExportModal(false)
    } catch {
      setExportError('Export failed. Please try again.')
    } finally {
      setExportLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/projects')}
          data-testid="back-btn">← Back</button>
        {summary && (
          <>
            <h2 className="page-title" data-testid="project-summary-name">{summary.name}</h2>
            {summary.description && (
              <span className="project-description" data-testid="project-summary-desc">
                {summary.description}
              </span>
            )}
            {/* US-026: Budget progress bar in project detail header */}
            {summary.budgetHours && (
              <div className="detail-budget-wrap" data-testid="detail-budget-bar">
                <div className="budget-bar-track" style={{ width: '220px' }}>
                  <div
                    className="budget-bar-fill"
                    style={{
                      width: `${Math.min((summary.budgetPercent ?? 0), 100)}%`,
                      background:
                        summary.budgetStatus === 'OVER_BUDGET' ? '#ef4444'
                        : summary.budgetStatus === 'WARNING'   ? '#f97316'
                        : '#22c55e',
                    }}
                  />
                </div>
                <span className="budget-bar-label" data-testid="detail-budget-label">
                  {(summary.usedHours ?? 0).toFixed(1)}h / {summary.budgetHours}h
                  {' '}({(summary.budgetPercent ?? 0).toFixed(0)}%)
                  {summary.budgetStatus === 'OVER_BUDGET' && (
                    <span className="budget-badge-over"> Over budget</span>
                  )}
                  {summary.budgetStatus === 'WARNING' && (
                    <span className="budget-badge-warn"> Approaching limit</span>
                  )}
                </span>
              </div>
            )}
          </>
        )}
        {/* US-024: Export button — opens the format/scope modal */}
        <button className="btn btn-secondary btn-sm export-btn"
          onClick={() => { setShowExportModal(true); setExportError('') }}
          data-testid="export-btn">
          Export
        </button>
      </div>

      {/* Date range preset bar */}
      <div className="preset-bar">
        {PRESETS.map(p => (
          <button key={p.key}
            className={`btn btn-ghost btn-sm ${preset === p.key ? 'active' : ''}`}
            onClick={() => setPreset(p.key)}
            data-testid={`preset-btn-${p.key}`}>
            {p.label}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <form className="custom-range-form" onSubmit={handleCustomApply}
          data-testid="custom-range-form">
          <label>From
            <input type="date" className="timer-input" value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              data-testid="custom-from" />
          </label>
          <label>To
            <input type="date" className="timer-input" value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              data-testid="custom-to" />
          </label>
          <button type="submit" className="btn btn-primary btn-sm"
            data-testid="custom-apply-btn">Apply</button>
        </form>
      )}

      {loading && <p className="empty-state" data-testid="summary-loading">Loading…</p>}
      {error   && <p className="timer-error" role="alert" data-testid="summary-error">{error}</p>}

      {summary && !loading && (
        <>
          {/* Total */}
          <div className="section">
            <div className="section-header">
              <h3>Total Time</h3>
              <span className="section-total" data-testid="project-summary-total">
                {formatSeconds(summary.totalSeconds)}
              </span>
            </div>
          </div>

          {/* Subprojects */}
          {summary.subprojects.length > 0 && (
            <div className="section" data-testid="subprojects-section">
              <div className="section-header"><h3>Subprojects</h3></div>
              <ul className="summary-list">
                {summary.subprojects.map(sub => (
                  <li key={sub.id} className="summary-list-item"
                    data-testid={`subproject-row-${sub.id}`}>
                    <span className="summary-item-name">{sub.name}</span>
                    <span className="summary-item-total" data-testid={`subproject-total-${sub.id}`}>
                      {formatSeconds(sub.totalSeconds)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── US-023: Contributors card — only shown for shared projects ────── */}
          {summary.contributions && summary.contributions.length > 1 && (
            <div className="section" data-testid="contributors-section">
              <div className="section-header">
                <h3>Contributors</h3>
                <span className="muted" data-testid="contributors-count">
                  {summary.contributions.length} contributor{summary.contributions.length !== 1 ? 's' : ''}
                </span>
              </div>
              <ul className="summary-list">
                {summary.contributions.map(c => (
                  <li key={c.userId} className="summary-list-item"
                    data-testid={`contributor-row-${c.userId}`}>
                    <span className="summary-item-name" data-testid={`contributor-name-${c.userId}`}>
                      {c.displayName}
                    </span>
                    <span className="summary-item-total" data-testid={`contributor-total-${c.userId}`}>
                      {formatSeconds(c.totalSeconds)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── US-023: User-filter dropdown — only shown for shared projects ── */}
          {summary.contributions && summary.contributions.length > 1 && (
            <div className="section user-filter-row">
              <label className="user-filter-label">
                Filter by user:
                <select
                  className="timer-input user-filter-select"
                  value={selectedUserId ?? ''}
                  onChange={e => setSelectedUserId(e.target.value ? Number(e.target.value) : null)}
                  data-testid="user-filter-select"
                >
                  <option value="">All users</option>
                  {summary.contributions.map(c => (
                    <option key={c.userId} value={c.userId}>{c.displayName}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {/* Tasks — grouped by description so repeated template sessions appear as one entry */}
          <ProjectTasksSection
            tasks={summary.tasks}
            contributions={summary.contributions}
            projectId={id}
            tz={tz}
          />
        </>
      )}

      {/* ── US-024: Export modal ─────────────────────────────────────────── */}
      {showExportModal && (
        <div className="modal-overlay" data-testid="export-modal">
          <div className="modal-content">
            <h3>Export Tasks</h3>
            <form onSubmit={handleExport}>

              {/* Format selector */}
              <div className="form-group">
                <label className="form-label">Format</label>
                <div className="radio-group">
                  <label>
                    <input type="radio" name="exportFormat" value="csv"
                      checked={exportFormat === 'csv'}
                      onChange={() => setExportFormat('csv')}
                      data-testid="export-format-csv" />
                    CSV
                  </label>
                  <label>
                    <input type="radio" name="exportFormat" value="json"
                      checked={exportFormat === 'json'}
                      onChange={() => setExportFormat('json')}
                      data-testid="export-format-json" />
                    JSON
                  </label>
                </div>
              </div>

              {/* Scope selector */}
              <div className="form-group">
                <label className="form-label">Date Range</label>
                <div className="radio-group">
                  <label>
                    <input type="radio" name="exportScope" value="all"
                      checked={exportScope === 'all'}
                      onChange={() => setExportScope('all')}
                      data-testid="export-scope-all" />
                    All Time
                  </label>
                  <label>
                    <input type="radio" name="exportScope" value="month"
                      checked={exportScope === 'month'}
                      onChange={() => setExportScope('month')}
                      data-testid="export-scope-month" />
                    Specific Month
                  </label>
                </div>
              </div>

              {/* Year + month inputs — only shown when scope = month */}
              {exportScope === 'month' && (
                <div className="form-group month-inputs">
                  <input type="number" className="timer-input" value={exportYear}
                    onChange={e => setExportYear(Number(e.target.value))}
                    placeholder="Year" min="2000" max="2099"
                    data-testid="export-year-input" />
                  <input type="number" className="timer-input" value={exportMonth}
                    onChange={e => setExportMonth(Number(e.target.value))}
                    placeholder="Month (1-12)" min="1" max="12"
                    data-testid="export-month-input" />
                </div>
              )}

              {exportError && (
                <p className="timer-error" role="alert" data-testid="export-error">
                  {exportError}
                </p>
              )}

              <div className="modal-actions">
                <button type="button" className="btn btn-ghost btn-sm"
                  onClick={() => setShowExportModal(false)}
                  disabled={exportLoading}
                  data-testid="export-cancel-btn">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm"
                  disabled={exportLoading}
                  data-testid="export-submit-btn">
                  {exportLoading ? 'Exporting…' : 'Download'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── US-022: Members section ──────────────────────────────────────── */}
      <div className="section" data-testid="members-section">
        <div className="section-header">
          <h3>Members</h3>
          <span className="muted" data-testid="members-count">
            {membersLoading ? '…' : `${members.length} member${members.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Invite form — only visible to the project owner */}
        {isOwner && (
          <form className="invite-form" onSubmit={handleInvite} data-testid="invite-form">
            <input
              type="email"
              className="timer-input"
              placeholder="Invite by email…"
              value={inviteEmail}
              onChange={e => { setInviteEmail(e.target.value); setInviteError('') }}
              required
              disabled={inviteLoading}
              data-testid="invite-email-input"
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={inviteLoading}
              data-testid="invite-submit-btn">
              {inviteLoading ? 'Inviting…' : 'Invite'}
            </button>
            {inviteError && (
              <p className="timer-error" role="alert" data-testid="invite-error">{inviteError}</p>
            )}
          </form>
        )}

        {/* Member list */}
        {members.length === 0 && !membersLoading ? (
          <p className="empty-state" data-testid="empty-members">No members yet.</p>
        ) : (
          <ul className="summary-list" data-testid="members-list">
            {members.map(member => (
              <li key={member.userId} className="summary-list-item"
                data-testid={`member-row-${member.userId}`}>
                <span className="summary-item-name" data-testid={`member-name-${member.userId}`}>
                  {member.displayName}
                </span>
                <span className="muted" data-testid={`member-email-${member.userId}`}>
                  {member.email}
                </span>
                <span className={`member-role role-${member.role.toLowerCase()}`}
                  data-testid={`member-role-${member.userId}`}>
                  {member.role}
                </span>
                {/* Remove button: shown to OWNER for all MEMBER rows (not for their own row) */}
                {isOwner && member.role === 'MEMBER' && (
                  <button className="btn btn-danger btn-xs"
                    onClick={() => handleRemoveMember(member.userId)}
                    data-testid={`remove-member-btn-${member.userId}`}>
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
