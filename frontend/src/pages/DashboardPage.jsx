import { useState, useEffect, useCallback } from 'react'
import { getDashboardSummary } from '../api/dashboardApi'
import * as templateApi from '../api/templateApi'
import * as projectApi from '../api/projectApi'
import { useTimer } from '../context/useTimer'
import { useToast } from '../context/useToast'

function formatSeconds(totalSecs) {
  const h = Math.floor(totalSecs / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = totalSecs % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function fmtHours(secs) {
  return `${(secs / 3600).toFixed(1)}h`
}

function flattenProjects(projects, depth = 0) {
  const result = []
  for (const p of projects) {
    result.push({ ...p, depth })
    if (p.subprojects?.length > 0) result.push(...flattenProjects(p.subprojects, depth + 1))
  }
  return result
}

export default function DashboardPage() {
  const { activeTask, elapsed, startTask, stopTask, refreshActiveTask } = useTimer()
  const toast = useToast()
  const [taskDesc, setTaskDesc] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [summary, setSummary]   = useState(null)

  // Templates state
  const [templates, setTemplates]         = useState([])
  const [allProjects, setAllProjects]     = useState([])
  const [showTemplateForm, setShowTemplateForm] = useState(false)
  const [tplName, setTplName]             = useState('')
  const [tplDesc, setTplDesc]             = useState('')
  const [tplProjectIds, setTplProjectIds] = useState([])
  const [tplLoading, setTplLoading]       = useState(false)
  const [tplError, setTplError]           = useState('')

  // Edit template state
  const [editingTplId, setEditingTplId]       = useState(null)
  const [editTplName, setEditTplName]         = useState('')
  const [editTplDesc, setEditTplDesc]         = useState('')
  const [editTplProjectIds, setEditTplProjectIds] = useState([])
  const [editTplLoading, setEditTplLoading]   = useState(false)
  const [editTplError, setEditTplError]       = useState('')

  // Delete confirm state
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  const fetchSummary = useCallback(() => {
    getDashboardSummary()
      .then(res => setSummary(res.data))
      .catch(() => {})
  }, [])

  const fetchTemplates = useCallback(() => {
    templateApi.listTemplates()
      .then(res => setTemplates(res.data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchSummary()
    fetchTemplates()
    projectApi.listProjects()
      .then(res => setAllProjects(flattenProjects(res.data)))
      .catch(() => {})
  }, [fetchSummary, fetchTemplates])

  // ── Timer handlers ────────────────────────────────────────────────────────

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

  // ── Template handlers ─────────────────────────────────────────────────────

  const toggleTplProject = (pid) =>
    setTplProjectIds(ids => ids.includes(pid) ? ids.filter(x => x !== pid) : [...ids, pid])

  const toggleEditTplProject = (pid) =>
    setEditTplProjectIds(ids => ids.includes(pid) ? ids.filter(x => x !== pid) : [...ids, pid])

  const handleCreateTemplate = async (e) => {
    e.preventDefault()
    setTplError('')
    if (!tplName.trim()) {
      setTplError('Template name is required.')
      return
    }
    setTplLoading(true)
    try {
      await templateApi.createTemplate(tplName, tplDesc || null, tplProjectIds)
      setTplName(''); setTplDesc(''); setTplProjectIds([])
      setShowTemplateForm(false)
      fetchTemplates()
      toast.success('Template created')
    } catch (err) {
      setTplError(err.response?.data?.message || 'Failed to create template')
    } finally {
      setTplLoading(false)
    }
  }

  const startEditTemplate = (t) => {
    setEditingTplId(t.id)
    setEditTplName(t.name)
    setEditTplDesc(t.description || '')
    setEditTplProjectIds((t.projects || []).map(p => p.id))
    setEditTplError('')
  }

  const handleSaveTemplate = async (id) => {
    setEditTplError('')
    setEditTplLoading(true)
    try {
      await templateApi.updateTemplate(id, editTplName, editTplDesc || null, editTplProjectIds)
      setEditingTplId(null)
      fetchTemplates()
      toast.success('Template updated')
    } catch (err) {
      setEditTplError(err.response?.data?.message || 'Failed to update template')
    } finally {
      setEditTplLoading(false)
    }
  }

  const handleDeleteTemplate = async (id) => {
    try {
      await templateApi.deleteTemplate(id)
      setDeleteConfirmId(null)
      fetchTemplates()
      toast.success('Template deleted')
    } catch {
      toast.error('Failed to delete template')
    }
  }

  const handleStartTemplate = async (id) => {
    setError('')
    try {
      await templateApi.startTemplate(id)
      await refreshActiveTask()
      fetchSummary()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to start template')
    }
  }

  const todaySecs   = summary?.todaySeconds ?? 0
  const weekSecs    = summary?.weekSeconds  ?? 0
  const topProjects = summary?.topProjects  ?? []

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Dashboard</h2>
      </div>

      <div className="dashboard-grid">

        {/* ── Left column: timer + templates ───────────────────────────── */}
        <div className="dashboard-main">

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
                  <button className="btn btn-danger btn-stop" onClick={handleStop}
                    disabled={loading} data-testid="stop-btn">
                    {loading ? 'Stopping…' : '■ Stop'}
                  </button>
                </div>
              ) : (
                <button className="btn btn-primary btn-start" onClick={handleStart}
                  disabled={loading} data-testid="start-btn">
                  {loading ? 'Starting…' : '▶ Start'}
                </button>
              )}
            </div>
            {error && <p className="timer-error" role="alert">{error}</p>}
          </div>

          {/* ── Templates section (US-027) ────────────────────────────── */}
          <div className="templates-section" data-testid="templates-section">
            <div className="section-header">
              <h3 className="section-title">Task Templates</h3>
              <button className="btn btn-primary btn-sm" data-testid="new-template-btn"
                onClick={() => { setShowTemplateForm(f => !f); setTplError('') }}>
                {showTemplateForm ? 'Cancel' : '+ New Template'}
              </button>
            </div>

            {showTemplateForm && (
              <form className="project-form" onSubmit={handleCreateTemplate} data-testid="template-form">
                <input className="timer-input" type="text" placeholder="Template name (required)"
                  value={tplName} onChange={e => setTplName(e.target.value)}
                  required disabled={tplLoading} data-testid="template-name-input" />
                <input className="timer-input" type="text" placeholder="Task description (optional)"
                  value={tplDesc} onChange={e => setTplDesc(e.target.value)}
                  disabled={tplLoading} data-testid="template-desc-input" />
                {allProjects.length > 0 && (
                  <fieldset className="project-selector" data-testid="template-project-selector">
                    <legend className="form-label">Projects (optional)</legend>
                    {allProjects.map(p => (
                      <label key={p.id} className="project-checkbox-label"
                        style={{ paddingLeft: `${p.depth * 1.5}rem`, display: 'block' }}>
                        <input type="checkbox"
                          data-testid={`template-project-checkbox-${p.id}`}
                          checked={tplProjectIds.includes(p.id)}
                          onChange={() => toggleTplProject(p.id)}
                          disabled={tplLoading} />
                        {' '}{'— '.repeat(p.depth)}{p.name}
                      </label>
                    ))}
                  </fieldset>
                )}
                {tplError && <p className="timer-error" role="alert">{tplError}</p>}
                <button type="submit" className="btn btn-primary"
                  disabled={tplLoading} data-testid="create-template-btn">
                  {tplLoading ? 'Saving…' : 'Create Template'}
                </button>
              </form>
            )}

            {templates.length === 0 && !showTemplateForm ? (
              <p className="empty-state" data-testid="templates-empty">
                No templates yet. Create one to quick-start recurring tasks!
              </p>
            ) : (
              <ul className="template-list" data-testid="template-list">
                {templates.map(t => (
                  <li key={t.id} className="template-card" data-testid={`template-card-${t.id}`}>
                    {editingTplId === t.id ? (
                      <form className="project-form" onSubmit={e => { e.preventDefault(); handleSaveTemplate(t.id) }}
                        data-testid={`template-edit-form-${t.id}`}>
                        <input className="timer-input" type="text" value={editTplName}
                          onChange={e => setEditTplName(e.target.value)} required
                          disabled={editTplLoading} data-testid={`template-edit-name-${t.id}`} />
                        <input className="timer-input" type="text" value={editTplDesc}
                          onChange={e => setEditTplDesc(e.target.value)} placeholder="Description (optional)"
                          disabled={editTplLoading} data-testid={`template-edit-desc-${t.id}`} />
                        {allProjects.length > 0 && (
                          <fieldset className="project-selector">
                            <legend className="form-label">Projects (optional)</legend>
                            {allProjects.map(p => (
                              <label key={p.id} className="project-checkbox-label"
                                style={{ paddingLeft: `${p.depth * 1.5}rem`, display: 'block' }}>
                                <input type="checkbox"
                                  data-testid={`template-edit-project-checkbox-${p.id}`}
                                  checked={editTplProjectIds.includes(p.id)}
                                  onChange={() => toggleEditTplProject(p.id)}
                                  disabled={editTplLoading} />
                                {' '}{'— '.repeat(p.depth)}{p.name}
                              </label>
                            ))}
                          </fieldset>
                        )}
                        {editTplError && <p className="timer-error" role="alert">{editTplError}</p>}
                        <div className="task-actions">
                          <button type="submit" className="btn btn-primary btn-xs"
                            disabled={editTplLoading} data-testid={`template-save-btn-${t.id}`}>
                            {editTplLoading ? 'Saving…' : 'Save'}
                          </button>
                          <button type="button" className="btn btn-ghost btn-xs"
                            onClick={() => setEditingTplId(null)}>Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <div className="template-card-content">
                        <div className="template-card-header">
                          <span className="template-name" data-testid={`template-name-${t.id}`}>
                            {t.name}
                          </span>
                          <div className="task-actions">
                            {activeTask && activeTask.description === (t.description || t.name) ? (
                              <button className="btn btn-success btn-xs"
                                data-testid={`template-running-indicator-${t.id}`}
                                disabled>
                                ● Running
                              </button>
                            ) : (
                              <button className="btn btn-primary btn-xs"
                                onClick={() => handleStartTemplate(t.id)}
                                disabled={!!activeTask}
                                data-testid={`template-start-btn-${t.id}`}>
                                ▶ Start
                              </button>
                            )}
                            <button className="btn btn-ghost btn-xs"
                              onClick={() => startEditTemplate(t)}
                              data-testid={`template-edit-btn-${t.id}`}>
                              Edit
                            </button>
                            <button className="btn btn-danger btn-xs"
                              onClick={() => setDeleteConfirmId(t.id)}
                              data-testid={`template-delete-btn-${t.id}`}>
                              Delete
                            </button>
                          </div>
                        </div>
                        {t.description && (
                          <p className="template-desc" data-testid={`template-desc-${t.id}`}>
                            {t.description}
                          </p>
                        )}
                        {t.projects?.length > 0 && (
                          <div className="template-projects" data-testid={`template-projects-${t.id}`}>
                            {t.projects.map(p => (
                              <span key={p.id} className="project-chip">{p.name}</span>
                            ))}
                          </div>
                        )}
                        {deleteConfirmId === t.id && (
                          <div className="delete-warning" role="alertdialog"
                            data-testid={`template-delete-dialog-${t.id}`}>
                            <p>Delete template "{t.name}"?</p>
                            <button className="btn btn-danger btn-sm"
                              onClick={() => handleDeleteTemplate(t.id)}
                              data-testid={`template-delete-confirm-btn-${t.id}`}>
                              Delete
                            </button>
                            <button className="btn btn-ghost btn-sm"
                              onClick={() => setDeleteConfirmId(null)}>Cancel</button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>{/* end dashboard-main */}

        {/* ── Right column: summary + running + top projects ─────────── */}
        <div className="dashboard-aside">

          {/* Summary cards — skeleton while loading */}
          {summary === null ? (
            <div className="dashboard-summary" data-testid="dashboard-summary">
              <div className="skeleton-card">
                <div className="skeleton skeleton-label" />
                <div className="skeleton skeleton-value" />
              </div>
              <div className="skeleton-card">
                <div className="skeleton skeleton-label" />
                <div className="skeleton skeleton-value" />
              </div>
            </div>
          ) : (
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
          )}

          {/* Running task from API */}
          {summary?.runningTask && (
            <div className="running-task-info" data-testid="running-task-info">
              <span>Tracking: </span>
              <strong data-testid="running-task-name">
                {summary.runningTask.description || '(no description)'}
              </strong>
            </div>
          )}

          {/* Top projects — skeleton while loading */}
          <div className="top-projects" data-testid="top-projects">
            <div className="section-header" style={{ padding: '0 0 .65rem', border: 'none' }}>
              <h3 className="section-title">Top Projects</h3>
              <span className="muted" style={{ fontSize: '11px' }}>This week</span>
            </div>
            {summary === null ? (
              <div className="skeleton-projects">
                {[1, 2, 3].map(i => (
                  <div key={i} className="skeleton-project-item">
                    <div className="skeleton skeleton-line-md" />
                    <div className="skeleton skeleton-label" style={{ marginLeft: 'auto', width: '40px' }} />
                  </div>
                ))}
              </div>
            ) : topProjects.length === 0 ? (
              <p className="empty-state" data-testid="top-projects-empty">
                No time tracked on projects yet.
              </p>
            ) : (
              <ul className="top-projects-list">
                {topProjects.map(p => (
                  <li key={p.id} className="top-project-item" data-testid={`top-project-${p.id}`}>
                    <span className="top-project-name">{p.name}</span>
                    <span className="top-project-time">{fmtHours(p.weekSeconds)}</span>
                    {p.budgetHours && (
                      <div className="budget-bar-wrap" data-testid={`dashboard-budget-bar-${p.id}`}>
                        <div className="budget-bar-track">
                          <div className="budget-bar-fill" style={{
                            width: `${Math.min(p.budgetPercent ?? 0, 100)}%`,
                            background: p.budgetStatus === 'OVER_BUDGET' ? 'var(--red)'
                              : p.budgetStatus === 'WARNING' ? 'var(--orange)' : 'var(--green)',
                          }} />
                        </div>
                        <span className="budget-bar-label" data-testid={`dashboard-budget-label-${p.id}`}>
                          {(p.usedHours ?? 0).toFixed(1)}h / {p.budgetHours}h
                        </span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>{/* end dashboard-aside */}

      </div>{/* end dashboard-grid */}
    </div>
  )
}
