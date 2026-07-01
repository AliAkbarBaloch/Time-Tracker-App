import { useState, useEffect, useCallback } from 'react'
import * as taskApi from '../api/taskApi'
import * as projectApi from '../api/projectApi'

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

function flattenProjects(projects, depth = 0) {
  const result = []
  for (const p of projects) {
    result.push({ ...p, depth })
    if (p.subprojects && p.subprojects.length > 0) {
      result.push(...flattenProjects(p.subprojects, depth + 1))
    }
  }
  return result
}

function ProjectCheckboxList({ flatProjects, selectedIds, onToggle, prefix, disabled }) {
  if (flatProjects.length === 0) return null
  return (
    <fieldset className="project-selector" data-testid={`${prefix}-project-selector`}>
      <legend className="form-label">Projects (optional)</legend>
      {flatProjects.map(p => (
        <label key={p.id} className="project-checkbox-label"
          style={{ paddingLeft: `${p.depth * 1.5}rem`, display: 'block' }}>
          <input
            type="checkbox"
            data-testid={`${prefix}-project-checkbox-${p.id}`}
            checked={selectedIds.includes(p.id)}
            onChange={() => onToggle(p.id)}
            disabled={disabled}
          />
          {' '}{'— '.repeat(p.depth)}{p.name}
        </label>
      ))}
    </fieldset>
  )
}

export default function TasksPage() {
  const [tasks, setTasks]                   = useState([])
  const [availableProjects, setAvailableProjects] = useState([])

  // filter state
  const [searchKw, setSearchKw]             = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterProjectId, setFilterProjectId] = useState('')
  const [filterFrom, setFilterFrom]         = useState('')
  const [filterTo, setFilterTo]             = useState('')

  const [showForm, setShowForm]             = useState(false)
  const [description, setDescription]       = useState('')
  const [startTime, setStartTime]           = useState('')
  const [endTime, setEndTime]               = useState('')
  const [createProjectIds, setCreateProjectIds] = useState([])
  const [loading, setLoading]               = useState(false)
  const [error, setError]                   = useState('')

  // edit state
  const [editingId, setEditingId]           = useState(null)
  const [editDesc, setEditDesc]             = useState('')
  const [editStart, setEditStart]           = useState('')
  const [editEnd, setEditEnd]               = useState('')
  const [editProjectIds, setEditProjectIds] = useState([])
  const [editError, setEditError]           = useState('')
  const [editLoading, setEditLoading]       = useState(false)

  // debounce search keyword 300 ms
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchKw), 300)
    return () => clearTimeout(id)
  }, [searchKw])

  const fetchTasks = useCallback(() => {
    const from = filterFrom ? new Date(filterFrom).toISOString() : null
    const to   = filterTo   ? new Date(filterTo + 'T23:59:59').toISOString() : null
    taskApi.listTasks(from, to, debouncedSearch || null, filterProjectId || null)
      .then(res => setTasks(res.data))
      .catch(() => {})
  }, [debouncedSearch, filterProjectId, filterFrom, filterTo])

  const fetchProjects = useCallback(() => {
    projectApi.listProjects()
      .then(res => setAvailableProjects(res.data))
      .catch(() => {})
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])
  useEffect(() => { fetchProjects() }, [fetchProjects])

  const toggleCreateProject = (id) => {
    setCreateProjectIds(ids => ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id])
  }

  const toggleEditProject = (id) => {
    setEditProjectIds(ids => ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id])
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    const start = new Date(startTime)
    const end   = new Date(endTime)
    if (start >= end) { setError('Start time must be before end time.'); return }
    if (end > new Date()) { setError('End time cannot be in the future.'); return }
    setLoading(true)
    try {
      await taskApi.createTask(
        description || null,
        start.toISOString(),
        end.toISOString(),
        createProjectIds.length > 0 ? createProjectIds : null
      )
      setDescription(''); setStartTime(''); setEndTime(''); setCreateProjectIds([])
      setShowForm(false)
      fetchTasks()
      fetchProjects()
    } catch (err) {
      const data = err.response?.data
      setError(data?.message || Object.values(data?.errors || {}).join(', ') || 'Failed to create task.')
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (task) => {
    setEditingId(task.id)
    setEditDesc(task.description || '')
    setEditStart(toLocalDatetimeValue(task.startTime))
    setEditEnd(toLocalDatetimeValue(task.endTime))
    setEditProjectIds((task.projects || []).map(p => p.id))
    setEditError('')
  }

  const cancelEdit = () => { setEditingId(null); setEditError('') }

  const handleReset = () => {
    setSearchKw('')
    setDebouncedSearch('')
    setFilterProjectId('')
    setFilterFrom('')
    setFilterTo('')
  }

  const handleDelete = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task? This action cannot be undone.')) return
    try {
      await taskApi.deleteTask(taskId)
      fetchTasks()
      fetchProjects()
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
      await taskApi.updateTask(
        taskId,
        editDesc || null,
        start.toISOString(),
        end.toISOString(),
        editProjectIds.length > 0 ? editProjectIds : null
      )
      setEditingId(null)
      fetchTasks()
      fetchProjects()
    } catch (err) {
      const data = err.response?.data
      setEditError(data?.message || Object.values(data?.errors || {}).join(', ') || 'Failed to update task.')
    } finally {
      setEditLoading(false)
    }
  }

  const flatProjects = flattenProjects(availableProjects)

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

      {/* Filter panel */}
      <div className="filter-panel" data-testid="filter-panel">
        <input
          className="timer-input filter-input"
          type="text"
          placeholder="Search by description…"
          value={searchKw}
          onChange={e => setSearchKw(e.target.value)}
          data-testid="filter-search-input"
        />
        <select
          className="timer-input filter-select"
          value={filterProjectId}
          onChange={e => setFilterProjectId(e.target.value)}
          data-testid="filter-project-select"
        >
          <option value="">All Projects</option>
          {flatProjects.map(p => (
            <option key={p.id} value={p.id}>{'— '.repeat(p.depth)}{p.name}</option>
          ))}
        </select>
        <input
          className="timer-input filter-date"
          type="date"
          value={filterFrom}
          onChange={e => setFilterFrom(e.target.value)}
          data-testid="filter-from"
        />
        <input
          className="timer-input filter-date"
          type="date"
          value={filterTo}
          onChange={e => setFilterTo(e.target.value)}
          data-testid="filter-to"
        />
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleReset}
          data-testid="filter-reset-btn"
        >Reset</button>
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
          <ProjectCheckboxList
            flatProjects={flatProjects}
            selectedIds={createProjectIds}
            onToggle={toggleCreateProject}
            prefix="create"
            disabled={loading}
          />
          <button type="submit" className="btn btn-primary" disabled={loading}
            data-testid="submit-task-btn">
            {loading ? 'Saving…' : 'Save Task'}
          </button>
          {error && <p className="timer-error" role="alert">{error}</p>}
        </form>
      )}

      <div className="task-list" data-testid="task-list">
        {tasks.length === 0 && !showForm && (
          (debouncedSearch || filterProjectId || filterFrom || filterTo)
            ? <p className="empty-state" data-testid="no-tasks-message">No tasks match the current filters.</p>
            : <p className="empty-state" data-testid="no-tasks-message">No tasks yet. Add your first task above.</p>
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
                <ProjectCheckboxList
                  flatProjects={flatProjects}
                  selectedIds={editProjectIds}
                  onToggle={toggleEditProject}
                  prefix="edit"
                  disabled={editLoading}
                />
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
                {t.projects && t.projects.length > 0 && (
                  <span className="task-projects" data-testid={`task-projects-${t.id}`}>
                    {t.projects.map(p => p.name).join(', ')}
                  </span>
                )}
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
