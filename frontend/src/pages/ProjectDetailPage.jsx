import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as projectApi from '../api/projectApi'

const PRESETS = [
  { key: 'all-time',   label: 'All Time' },
  { key: 'today',      label: 'Today' },
  { key: 'this-week',  label: 'This Week' },
  { key: 'this-month', label: 'This Month' },
  { key: 'custom',     label: 'Custom' },
]

function getPresetRange(preset) {
  const now = new Date()
  switch (preset) {
    case 'today': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      return { from: start.toISOString(), to: new Date(start.getTime() + 86400000).toISOString() }
    }
    case 'this-week': {
      const dow = now.getDay()
      const diff = dow === 0 ? -6 : 1 - dow
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff)
      return { from: monday.toISOString(), to: new Date(monday.getTime() + 7 * 86400000).toISOString() }
    }
    case 'this-month': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1)
      const next  = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      return { from: first.toISOString(), to: next.toISOString() }
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

function formatTaskDuration(startTime, endTime) {
  if (!endTime) return '(running)'
  const secs = Math.floor((new Date(endTime) - new Date(startTime)) / 1000)
  return formatSeconds(secs)
}

export default function ProjectDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [preset, setPreset]         = useState('all-time')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo]     = useState('')
  const [summary, setSummary]       = useState(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  const fetchSummary = useCallback(() => {
    let from = null
    let to   = null

    if (preset === 'custom') {
      from = customFrom ? new Date(customFrom).toISOString() : null
      to   = customTo   ? new Date(customTo + 'T23:59:59').toISOString() : null
    } else {
      const range = getPresetRange(preset)
      from = range.from
      to   = range.to
    }

    setLoading(true)
    setError('')
    projectApi.getProjectSummary(id, from, to)
      .then(res => setSummary(res.data))
      .catch(err => {
        if (err.response?.status === 404) {
          setError('Project not found.')
        } else {
          setError('Failed to load project summary.')
        }
      })
      .finally(() => setLoading(false))
  }, [id, preset, customFrom, customTo])

  useEffect(() => {
    if (preset !== 'custom') {
      fetchSummary()
    }
  }, [preset, fetchSummary])

  const handleCustomApply = (e) => {
    e.preventDefault()
    fetchSummary()
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
          </>
        )}
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

          {/* Tasks */}
          <div className="section" data-testid="tasks-section">
            <div className="section-header">
              <h3>Tasks</h3>
              <span className="muted">{summary.tasks.length} task{summary.tasks.length !== 1 ? 's' : ''}</span>
            </div>
            {summary.tasks.length === 0 ? (
              <p className="empty-state" data-testid="empty-tasks">
                No tasks in this period.
              </p>
            ) : (
              <ul className="summary-list">
                {summary.tasks.map(t => (
                  <li key={t.id} className="summary-list-item"
                    data-testid={`summary-task-${t.id}`}>
                    <span className="summary-item-name">{t.description || '(no description)'}</span>
                    <span className="summary-item-time muted">
                      {new Date(t.startTime).toLocaleDateString()}
                    </span>
                    <span className="summary-item-total" data-testid={`summary-task-duration-${t.id}`}>
                      {formatTaskDuration(t.startTime, t.endTime)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
