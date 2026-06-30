import { useState, useEffect, useCallback } from 'react'
import * as taskApi from '../api/taskApi'

function formatDuration(startTime, endTime) {
  if (!endTime) return '—'
  const secs = Math.floor((new Date(endTime) - new Date(startTime)) / 1000)
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return h > 0
    ? `${h}h ${String(m).padStart(2, '0')}m`
    : `${m}m ${String(s).padStart(2, '0')}s`
}

function toLocalDatetimeValue(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function TasksPage() {
  const [tasks, setTasks]         = useState([])
  const [showForm, setShowForm]   = useState(false)
  const [description, setDescription] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  const fetchTasks = useCallback(() => {
    taskApi.listTasks()
      .then(res => setTasks(res.data))
      .catch(() => {})
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')

    const start = new Date(startTime)
    const end   = new Date(endTime)
    if (start >= end) {
      setError('Start time must be before end time.')
      return
    }
    if (end > new Date()) {
      setError('End time cannot be in the future.')
      return
    }

    setLoading(true)
    try {
      await taskApi.createTask(description || null, start.toISOString(), end.toISOString())
      setDescription(''); setStartTime(''); setEndTime('')
      setShowForm(false)
      fetchTasks()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create task.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Tasks</h2>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => { setShowForm(f => !f); setError('') }}
          data-testid="add-task-btn"
        >
          {showForm ? 'Cancel' : '+ Add Task'}
        </button>
      </div>

      {showForm && (
        <form className="project-form" onSubmit={handleCreate} data-testid="add-task-form">
          <input
            className="timer-input"
            type="text"
            placeholder="Description (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            disabled={loading}
            data-testid="task-desc-input"
          />
          <label className="form-label">Start time</label>
          <input
            className="timer-input"
            type="datetime-local"
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
            required
            disabled={loading}
            data-testid="task-start-input"
          />
          <label className="form-label">End time</label>
          <input
            className="timer-input"
            type="datetime-local"
            value={endTime}
            onChange={e => setEndTime(e.target.value)}
            required
            disabled={loading}
            data-testid="task-end-input"
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            data-testid="submit-task-btn"
          >
            {loading ? 'Saving…' : 'Save Task'}
          </button>
          {error && <p className="timer-error" role="alert">{error}</p>}
        </form>
      )}

      <div className="task-list" data-testid="task-list">
        {tasks.length === 0 && !showForm && (
          <p className="empty-state">No tasks yet. Add your first task above.</p>
        )}
        {tasks.map(t => (
          <div key={t.id} className="task-row" data-testid={`task-item-${t.id}`}>
            <span className="task-description">{t.description || '(no description)'}</span>
            <span className="task-time">{new Date(t.startTime).toLocaleString()}</span>
            <span className="task-duration">{formatDuration(t.startTime, t.endTime)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
