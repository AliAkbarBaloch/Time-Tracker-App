import { useState, useEffect, useCallback } from 'react'
import { getDashboardSummary } from '../api/dashboardApi'
import { useTimer } from '../context/TimerContext'

function formatSeconds(totalSecs) {
  const h = Math.floor(totalSecs / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = totalSecs % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function fmtHours(secs) {
  const h = (secs / 3600).toFixed(1)
  return `${h}h`
}

export default function DashboardPage() {
  const { activeTask, elapsed, startTask, stopTask } = useTimer()
  const [taskDesc, setTaskDesc] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [summary, setSummary]   = useState(null)

  const fetchSummary = useCallback(() => {
    getDashboardSummary()
      .then(res => setSummary(res.data))
      .catch(() => {})
  }, [])

  useEffect(() => { fetchSummary() }, [fetchSummary])

  const handleStart = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      await startTask(taskDesc)
      setTaskDesc('')
      fetchSummary()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start timer')
    } finally {
      setLoading(false)
    }
  }, [taskDesc, startTask, fetchSummary])

  const handleStop = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      await stopTask()
      fetchSummary()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to stop timer')
    } finally {
      setLoading(false)
    }
  }, [stopTask, fetchSummary])

  const todaySecs = summary?.todaySeconds ?? 0
  const weekSecs  = summary?.weekSeconds  ?? 0
  const topProjects = summary?.topProjects ?? []

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Dashboard</h2>
      </div>

      {/* Timer card */}
      <div className="timer-card">
        <div className="timer-section">
          {!activeTask && (
            <input
              className="timer-input"
              type="text"
              placeholder="What are you working on?"
              value={taskDesc}
              onChange={e => setTaskDesc(e.target.value)}
              disabled={loading}
              data-testid="task-desc-input"
            />
          )}
          {activeTask ? (
            <div className="timer-running">
              <span className="timer-description" data-testid="running-task-desc">
                {activeTask.description || 'Timer running'}
              </span>
              <span className="timer-display" data-testid="elapsed">{elapsed}</span>
              <button
                className="btn btn-danger btn-stop"
                onClick={handleStop}
                disabled={loading}
                data-testid="stop-btn"
              >
                {loading ? 'Stopping…' : '■ Stop'}
              </button>
            </div>
          ) : (
            <button
              className="btn btn-primary btn-start"
              onClick={handleStart}
              disabled={loading}
              data-testid="start-btn"
            >
              {loading ? 'Starting…' : '▶ Start'}
            </button>
          )}
        </div>
        {error && <p className="timer-error" role="alert">{error}</p>}
      </div>

      {/* Summary cards */}
      <div className="dashboard-summary" data-testid="dashboard-summary">
        <div className="summary-card" data-testid="today-card">
          <span className="summary-label">Today</span>
          <span className="summary-value" data-testid="today-seconds">{formatSeconds(todaySecs)}</span>
        </div>
        <div className="summary-card" data-testid="week-card">
          <span className="summary-label">This Week</span>
          <span className="summary-value" data-testid="week-seconds">{formatSeconds(weekSecs)}</span>
        </div>
      </div>

      {/* Running task from API */}
      {summary?.runningTask && (
        <div className="running-task-info" data-testid="running-task-info">
          <span>Currently tracking: </span>
          <strong data-testid="running-task-name">
            {summary.runningTask.description || '(no description)'}
          </strong>
        </div>
      )}

      {/* Top projects */}
      <div className="top-projects" data-testid="top-projects">
        <h3 className="section-title">Top Projects This Week</h3>
        {topProjects.length === 0 ? (
          <p className="empty-state" data-testid="top-projects-empty">
            No time tracked on projects yet. Start a task and assign it to a project!
          </p>
        ) : (
          <ul className="top-projects-list">
            {topProjects.map(p => (
              <li key={p.id} className="top-project-item" data-testid={`top-project-${p.id}`}>
                <span className="top-project-name">{p.name}</span>
                <span className="top-project-time">{fmtHours(p.weekSeconds)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
