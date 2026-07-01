import { useState, useEffect, useCallback } from 'react'
import * as taskApi from '../api/taskApi'
import { useTimer } from '../context/TimerContext'

function formatSeconds(totalSecs) {
  const h = Math.floor(totalSecs / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = totalSecs % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatTaskDuration(startTime, endTime) {
  if (!endTime) return '—'
  const secs = Math.floor((new Date(endTime) - new Date(startTime)) / 1000)
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(s).padStart(2, '0')}s`
}

function todayRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { from: start.toISOString(), to: end.toISOString() }
}

export default function DashboardPage() {
  const { activeTask, elapsed, startTask, stopTask } = useTimer()
  const [taskDesc, setTaskDesc]     = useState('')
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [todayTasks, setTodayTasks] = useState([])
  const [dailyTotal, setDailyTotal] = useState(0)

  const fetchTodayTasks = useCallback(() => {
    const { from, to } = todayRange()
    taskApi.listTasks(from, to)
      .then(res => setTodayTasks(res.data))
      .catch(() => {})
  }, [])

  useEffect(() => { fetchTodayTasks() }, [fetchTodayTasks])

  // Recalculate daily total every second when a running task is in the list
  useEffect(() => {
    const calc = () => {
      let total = 0
      for (const t of todayTasks) {
        if (t.running) {
          total += Math.floor((Date.now() - new Date(t.startTime).getTime()) / 1000)
        } else if (t.endTime) {
          total += Math.floor((new Date(t.endTime) - new Date(t.startTime)) / 1000)
        }
      }
      setDailyTotal(total)
    }
    calc()
    if (!todayTasks.some(t => t.running)) return
    const id = setInterval(calc, 1000)
    return () => clearInterval(id)
  }, [todayTasks])

  const handleStart = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      await startTask(taskDesc)
      setTaskDesc('')
      fetchTodayTasks()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start timer')
    } finally {
      setLoading(false)
    }
  }, [taskDesc, startTask, fetchTodayTasks])

  const handleStop = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      await stopTask()
      fetchTodayTasks()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to stop timer')
    } finally {
      setLoading(false)
    }
  }, [stopTask, fetchTodayTasks])

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Dashboard</h2>
      </div>

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

      <div className="today-section" data-testid="today-section">
        <div className="today-header">
          <h3 className="today-title">Today</h3>
          <span className="daily-total" data-testid="daily-total">{formatSeconds(dailyTotal)}</span>
        </div>

        {todayTasks.length === 0 ? (
          <p className="empty-state" data-testid="today-empty">No tasks tracked today yet.</p>
        ) : (
          <div className="today-task-list">
            {todayTasks.map(t => (
              <div
                key={t.id}
                className={`task-row${t.running ? ' task-row--running' : ''}`}
                data-testid={`today-task-${t.id}`}
              >
                <span className="task-description">{t.description || '(no description)'}</span>
                <span className="task-time">{new Date(t.startTime).toLocaleTimeString()}</span>
                <span className="task-duration" data-testid={`today-task-duration-${t.id}`}>
                  {t.running ? elapsed : formatTaskDuration(t.startTime, t.endTime)}
                </span>
                {t.projects && t.projects.length > 0 && (
                  <span className="task-projects">
                    {t.projects.map(p => p.name).join(', ')}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
