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
  const [tasks, setTasks]             = useState([])
  const [showForm, setShowForm]       = useState(false)
  const [description, setDescription] = useState('')
  const [startTime, setStartTime]     = useState('')
  const [endTime, setEndTime]         = useState('')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')

  // edit state
  const [editingId, setEditingId]         = useState(null)
  const [editDesc, setEditDesc]           = useState('')
  const [editStart, setEditStart]         = useState('')
  const [editEnd, setEditEnd]             = useState('')
  const [editError, setEditError]         = useState('')
  const [editLoading, setEditLoading]     = useState(false)

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
    if (start >= end) { setError('Start time must be before end time.'); return }
    if (end > new Date()) { setError('End time cannot be in the future.'); return }
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

  const startEdit = (task) => {
    setEditingId(task.id)
    setEditDesc(task.description || '')
    setEditStart(toLocalDatetimeValue(task.startTime))
    setEditEnd(toLocalDatetimeValue(task.endTime))
    setEditError('')
  }

  const cancelEdit = () => { setEditingId(null); setEditError('') }

  const handleDelete = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task? This action cannot be undone.')) return
    try {
      await taskApi.deleteTask(taskId)
      fetchTasks()
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete task.')
    }
  }

  const handleUpdate = async (e, taskId) => {
    e.preventDefault()
    setEditError('')
    const start = new Date(editStart)
    const end   = new Date(editEnd)
    if (start >= end) { setEditError('Start time must be before end time.'); return }
    setEditLoading(true)
    try {
      await taskApi.updateTask(taskId, editDesc || null, start.toISOString(), end.toISOString())
      setEditingId(null)
      fetchTasks()
    } catch (err) {
      setEditError(err.response?.data?.message || 'Failed to update task.')
    } finally {
      setEditLoading(false)
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
          <input className="timer-input" type="text" placeholder="Description (optional)"
            value={description} onChange={e => setDescription(e.target.value)}
            disabled={loading} data-testid="task-desc-input" />
          <label className="form-label">Start time</label>
          <input className="timer-input" type="datetime-local" value={startTime}
            onChange={e => setStartTime(e.target.value)} required disabled={loading}
            data-testid="task-start-input" />
          <label className="form-label">End time</label>
          <input className="timer-input" type="datetime-local" value={endTime}
            onChange={e => setEndTime(e.target.value)} required disabled={loading}
            data-testid="task-end-input" />
          <button type="submit" className="btn btn-primary" disabled={loading}
            data-testid="submit-task-btn">
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
            {editingId === t.id ? (
              <form className="task-edit-form" onSubmit={e => handleUpdate(e, t.id)}
                data-testid={`edit-form-${t.id}`}>
                <input className="timer-input" type="text" value={editDesc}
                  onChange={e => setEditDesc(e.target.value)} disabled={editLoading}
                  data-testid="edit-desc-input" />
                <input className="timer-input" type="datetime-local" value={editStart}
                  onChange={e => setEditStart(e.target.value)} required disabled={editLoading}
                  data-testid="edit-start-input" />
                <input className="timer-input" type="datetime-local" value={editEnd}
                  onChange={e => setEditEnd(e.target.value)} required disabled={editLoading}
                  data-testid="edit-end-input" />
                {editError && <p className="timer-error" role="alert">{editError}</p>}
                <div className="task-actions">
                  <button type="submit" className="btn btn-primary btn-xs"
                    disabled={editLoading} data-testid="save-edit-btn">
                    {editLoading ? 'Saving…' : 'Save'}
                  </button>
                  <button type="button" className="btn btn-ghost btn-xs"
                    onClick={cancelEdit} data-testid="cancel-edit-btn">Cancel</button>
                </div>
              </form>
            ) : (
              <>
                <span className="task-description">{t.description || '(no description)'}</span>
                <span className="task-time">{new Date(t.startTime).toLocaleString()}</span>
                <span className="task-duration">{formatDuration(t.startTime, t.endTime)}</span>
                <div className="task-actions">
                  <button className="btn btn-ghost btn-xs" onClick={() => startEdit(t)}
                    data-testid={`edit-btn-${t.id}`}>Edit</button>
                  <button className="btn btn-danger btn-xs" onClick={() => handleDelete(t.id)}
                    data-testid={`delete-btn-${t.id}`}>Delete</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
