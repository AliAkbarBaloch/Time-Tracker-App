import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import * as taskApi from '../api/taskApi'
import * as projectApi from '../api/projectApi'
import { useAuth } from '../context/AuthContext'
import { toDatetimeLocalInTz, formatInZone, nowInTz, localDateToUtcIso } from '../utils/dateUtils'

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

function formatTotalSeconds(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return h > 0
    ? `${h}h ${String(m).padStart(2, '0')}m`
    : `${m}m ${String(s).padStart(2, '0')}s`
}

/**
 * Convert a datetime-local string ("YYYY-MM-DDTHH:MM") or ISO string to UTC ISO,
 * interpreting it as local time in the given IANA timezone.
 * Falls back to native Date parsing for ISO strings (test-env compatibility).
 */
function datetimeLocalToUtcIso(dtLocal, tz) {
  if (!dtLocal) return null
  const match = dtLocal.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (match) {
    const [, y, m, d, h, min] = match.map(Number)
    return localDateToUtcIso(y, m, d, h, min, 0, tz)
  }
  return new Date(dtLocal).toISOString()
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
  const { user } = useAuth()
  const tz = user?.timezone ?? 'UTC'
  const [searchParams] = useSearchParams()

  const [tasks, setTasks]                   = useState([])
  const [availableProjects, setAvailableProjects] = useState([])

  // filter state — seed from URL params so ?search=X&from=Y works on navigation
  const [searchKw, setSearchKw]             = useState(searchParams.get('search') ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('search') ?? '')
  const [filterProjectId, setFilterProjectId] = useState(searchParams.get('projectId') ?? '')
  const [filterFrom, setFilterFrom]         = useState(searchParams.get('from') ?? '')
  const [filterTo, setFilterTo]             = useState(searchParams.get('to') ?? '')

  const [showForm, setShowForm]             = useState(false)
  const [description, setDescription]       = useState('')
  const [startTime, setStartTime]           = useState('')
  const [endTime, setEndTime]               = useState('')
  const initProjectId = searchParams.get('projectId')
  const [createProjectIds, setCreateProjectIds] = useState(
    initProjectId ? [parseInt(initProjectId, 10)] : []
  )
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
    const fromDate = filterFrom ? new Date(filterFrom) : null
    const from = fromDate && !isNaN(fromDate.getTime()) ? fromDate.toISOString() : null
    const toDate = filterTo ? new Date(filterTo + 'T23:59:59') : null
    const to = toDate && !isNaN(toDate.getTime()) ? toDate.toISOString() : null
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

  // Auto-open add-task form when navigated from a project page (?addTask=true)
  useEffect(() => {
    if (searchParams.get('addTask') === 'true') {
      setShowForm(true)
      setStartTime(nowInTz(tz))
      setEndTime(nowInTz(tz))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCreateProject = (id) => {
    setCreateProjectIds(ids => ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id])
  }

  const toggleEditProject = (id) => {
    setEditProjectIds(ids => ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id])
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    const startIso = datetimeLocalToUtcIso(startTime, tz)
    const endIso   = datetimeLocalToUtcIso(endTime, tz)
    if (new Date(startIso) >= new Date(endIso)) { setError('Start time must be before end time.'); return }
    if (new Date(endIso) > new Date()) { setError('End time cannot be in the future.'); return }
    setLoading(true)
    try {
      await taskApi.createTask(
        description || null,
        startIso,
        endIso,
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
    setEditStart(toDatetimeLocalInTz(task.startTime, tz))
    setEditEnd(toDatetimeLocalInTz(task.endTime, tz))
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
    const startIso = datetimeLocalToUtcIso(editStart, tz)
    const endIso   = datetimeLocalToUtcIso(editEnd, tz)
    if (new Date(startIso) >= new Date(endIso)) { setEditError('Start time must be before end time.'); return }
    setEditLoading(true)
    try {
      await taskApi.updateTask(
        taskId,
        editDesc || null,
        startIso,
        endIso,
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

  // Group completed tasks by description so repeated template sessions collapse into one row
  const groupedTasks = useMemo(() => {
    const groups = new Map()
    const sorted = [...tasks].sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
    for (const task of sorted) {
      const key = task.description ?? '__no_desc__'
      if (!groups.has(key)) {
        groups.set(key, { key, description: task.description, sessions: [], totalSeconds: 0 })
      }
      const group = groups.get(key)
      group.sessions.push(task)
      if (task.endTime) {
        const secs = Math.floor((new Date(task.endTime) - new Date(task.startTime)) / 1000)
        if (secs > 0) group.totalSeconds += secs
      }
    }
    return [...groups.values()]
  }, [tasks])

  const [expandedGroups, setExpandedGroups] = useState(new Set())

  const toggleGroup = (key) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Tasks</h2>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            if (!showForm) {
              setStartTime(nowInTz(tz))
              setEndTime(nowInTz(tz))
            }
            setShowForm(f => !f)
            setError('')
          }}
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
          aria-label="Start date"
          value={filterFrom}
          onChange={e => setFilterFrom(e.target.value)}
          data-testid="filter-from"
        />
        <input
          className="timer-input filter-date"
          type="date"
          aria-label="End date"
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
        {groupedTasks.map(group => {
          const isSingle = group.sessions.length === 1
          const latestTask = group.sessions[0]

          if (isSingle) {
            const t = latestTask
            return (
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
                    <span className="task-time">
                      {formatInZone(t.startTime, tz, { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
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
            )
          }

          // Multiple sessions with the same description — show one consolidated row
          const isExpanded = expandedGroups.has(group.key)
          return (
            <div key={group.key} className="task-group" data-testid={`task-group-${group.key}`}>
              <div className="task-row task-group-header">
                <span className="task-description">{group.description || '(no description)'}</span>
                <span className="task-time">
                  {formatInZone(latestTask.startTime, tz, { dateStyle: 'short', timeStyle: 'short' })}
                </span>
                <span className="task-duration">{formatTotalSeconds(group.totalSeconds)}</span>
                {latestTask.projects && latestTask.projects.length > 0 && (
                  <span className="task-projects">
                    {latestTask.projects.map(p => p.name).join(', ')}
                  </span>
                )}
                <button className="btn btn-ghost btn-xs task-sessions-toggle"
                  onClick={() => toggleGroup(group.key)}
                  data-testid={`task-group-toggle-${group.key}`}>
                  {isExpanded ? '▲ Hide' : `▼ ${group.sessions.length} sessions`}
                </button>
              </div>
              {isExpanded && (
                <div className="task-group-sessions">
                  {group.sessions.map(t => (
                    <div key={t.id} className="task-row task-session-row"
                      data-testid={`task-item-${t.id}`}>
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
                          <span className="task-time task-session-time">
                            {formatInZone(t.startTime, tz, { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
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
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
