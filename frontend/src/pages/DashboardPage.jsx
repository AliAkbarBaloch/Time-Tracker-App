import { useState, useEffect, useCallback } from 'react'
import * as taskApi from '../api/taskApi'

export default function DashboardPage() {
  const [activeTask, setActiveTask]   = useState(null)
  const [taskDesc, setTaskDesc]       = useState('')
  const [elapsed, setElapsed]         = useState('00:00:00')
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)

  // Fetch active task on mount
  useEffect(() => {
    taskApi.getActiveTask()
      .then(res => { if (res.status === 200) setActiveTask(res.data) })
      .catch(() => {})
  }, [])

  // Tick elapsed time every second when a task is running
  useEffect(() => {
    if (!activeTask) { setElapsed('00:00:00'); return }
    const update = () => {
      const secs = Math.floor((Date.now() - new Date(activeTask.startTime).getTime()) / 1000)
      const h = String(Math.floor(secs / 3600)).padStart(2, '0')
      const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0')
      const s = String(secs % 60).padStart(2, '0')
      setElapsed(`${h}:${m}:${s}`)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [activeTask])

  const handleStart = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const { data } = await taskApi.startTask(taskDesc || null)
      setActiveTask(data)
      setTaskDesc('')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start timer')
    } finally {
      setLoading(false)
    }
  }, [taskDesc])

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Dashboard</h2>
      </div>

      {/* Timer Widget */}
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
            />
          )}
          {activeTask ? (
            <div className="timer-running">
              <span className="timer-description">{activeTask.description || 'Timer running'}</span>
              <span className="timer-display" data-testid="elapsed">{elapsed}</span>
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

      {/* Summary Cards — static until US-007/008 */}
      <div className="summary-row">
        <div className="summary-card">
          <span className="summary-label">Today</span>
          <span className="summary-value">—</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">This Week</span>
          <span className="summary-value">—</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">This Month</span>
          <span className="summary-value">—</span>
        </div>
      </div>
    </div>
  )
}
