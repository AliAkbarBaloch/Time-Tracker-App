import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import * as projectApi from '../api/projectApi'

function formatDuration(totalSeconds) {
  if (!totalSeconds) return '0m'
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
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

function ProjectTree({ projects, depth = 0, editingId, editName, editDesc, editError, editLoading,
  onStartEdit, onEditName, onEditDesc, onSaveEdit, onCancelEdit, onDelete, onView }) {
  const [collapsed, setCollapsed] = useState({})
  const toggle = id => setCollapsed(c => ({ ...c, [id]: !c[id] }))

  return (
    <ul className="project-tree" style={{ paddingLeft: depth > 0 ? '1.5rem' : 0 }}>
      {projects.map(p => (
        <li key={p.id} className="project-tree-item">
          {editingId === p.id ? (
            <form
              className="project-edit-form"
              onSubmit={e => { e.preventDefault(); onSaveEdit(p.id) }}
              data-testid={`edit-form-${p.id}`}
            >
              <input className="timer-input" type="text" value={editName}
                onChange={e => onEditName(e.target.value)} required disabled={editLoading}
                data-testid="edit-project-name-input" />
              <input className="timer-input" type="text" value={editDesc}
                onChange={e => onEditDesc(e.target.value)} disabled={editLoading}
                placeholder="Description (optional)"
                data-testid="edit-project-desc-input" />
              {editError && <p className="timer-error" role="alert">{editError}</p>}
              <div className="task-actions">
                <button type="submit" className="btn btn-primary btn-xs" disabled={editLoading}
                  data-testid="save-project-edit-btn">
                  {editLoading ? 'Saving…' : 'Save'}
                </button>
                <button type="button" className="btn btn-ghost btn-xs" onClick={onCancelEdit}
                  data-testid="cancel-project-edit-btn">Cancel</button>
              </div>
            </form>
          ) : (
            <div className="project-row">
              {p.subprojects && p.subprojects.length > 0 && (
                <button className="btn-collapse" onClick={() => toggle(p.id)}
                  data-testid={`collapse-btn-${p.id}`}
                  aria-label={collapsed[p.id] ? 'Expand' : 'Collapse'}>
                  {collapsed[p.id] ? '▶' : '▼'}
                </button>
              )}
              <button className="btn-link project-name" onClick={() => onView(p.id)}
                data-testid={`project-name-${p.id}`}>{p.name}</button>
              {/* Shared badge visible to invited members (US-022) */}
              {p.shared && (
                <span className="shared-badge" data-testid={`shared-badge-${p.id}`} title="Shared with you">
                  👥 Shared
                </span>
              )}
              {p.description && <span className="project-description">{p.description}</span>}
              <span className="project-total" data-testid={`project-total-${p.id}`}>
                {formatDuration(p.totalSeconds)}
              </span>
              <div className="task-actions">
                <button className="btn btn-ghost btn-xs" onClick={() => onStartEdit(p)}
                  data-testid={`edit-project-btn-${p.id}`}>Edit</button>
                <button className="btn btn-danger btn-xs" onClick={() => onDelete(p.id, false)}
                  data-testid={`delete-project-btn-${p.id}`}>Delete</button>
              </div>
            </div>
          )}
          {p.subprojects && p.subprojects.length > 0 && !collapsed[p.id] && (
            <ProjectTree projects={p.subprojects} depth={depth + 1}
              editingId={editingId} editName={editName} editDesc={editDesc}
              editError={editError} editLoading={editLoading}
              onStartEdit={onStartEdit} onEditName={onEditName} onEditDesc={onEditDesc}
              onSaveEdit={onSaveEdit} onCancelEdit={onCancelEdit} onDelete={onDelete}
              onView={onView} />
          )}
        </li>
      ))}
    </ul>
  )
}

export default function ProjectsPage() {
  const navigate = useNavigate()
  const [projects, setProjects]               = useState([])
  const [showForm, setShowForm]               = useState(false)
  const [name, setName]                       = useState('')
  const [description, setDescription]         = useState('')
  const [parentProjectId, setParentProjectId] = useState('')
  const [loading, setLoading]                 = useState(false)
  const [error, setError]                     = useState('')

  // edit state
  const [editingId, setEditingId]     = useState(null)
  const [editName, setEditName]       = useState('')
  const [editDesc, setEditDesc]       = useState('')
  const [editError, setEditError]     = useState('')
  const [editLoading, setEditLoading] = useState(false)

  // delete warning state
  const [deleteWarning, setDeleteWarning] = useState(null) // { id, taskCount, subprojectCount }

  const fetchProjects = useCallback(() => {
    projectApi.listProjects()
      .then(res => setProjects(res.data))
      .catch(() => {})
  }, [])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await projectApi.createProject(name, description || null,
        parentProjectId ? Number(parentProjectId) : null)
      setName(''); setDescription(''); setParentProjectId('')
      setShowForm(false)
      fetchProjects()
    } catch (err) {
      const data = err.response?.data
      setError(data?.message || Object.values(data?.errors || {}).join(', ') || 'Failed to create project')
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (project) => {
    setEditingId(project.id)
    setEditName(project.name)
    setEditDesc(project.description || '')
    setEditError('')
  }

  const cancelEdit = () => { setEditingId(null); setEditError('') }

  const saveEdit = async (id) => {
    setEditError('')
    setEditLoading(true)
    try {
      await projectApi.updateProject(id, editName, editDesc || null)
      setEditingId(null)
      fetchProjects()
    } catch (err) {
      const data = err.response?.data
      setEditError(data?.message || Object.values(data?.errors || {}).join(', ') || 'Failed to update project.')
    } finally {
      setEditLoading(false)
    }
  }

  const handleDelete = async (id, force) => {
    try {
      await projectApi.deleteProject(id, force)
      setDeleteWarning(null)
      fetchProjects()
    } catch (err) {
      const data = err.response?.data
      if (err.response?.status === 409 && !force) {
        setDeleteWarning({ id, taskCount: data?.taskCount ?? 0, subprojectCount: data?.subprojectCount ?? 0 })
      } else {
        alert(data?.message || 'Failed to delete project.')
      }
    }
  }

  const allFlat = flattenProjects(projects)

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Projects</h2>
        <button className="btn btn-primary btn-sm"
          onClick={() => { setShowForm(f => !f); setError('') }}
          data-testid="new-project-btn">
          {showForm ? 'Cancel' : '+ New Project'}
        </button>
      </div>

      {showForm && (
        <form className="project-form" onSubmit={handleCreate} data-testid="project-form">
          <input className="timer-input" type="text" placeholder="Project name" value={name}
            onChange={e => setName(e.target.value)} required disabled={loading}
            data-testid="project-name-input" />
          <input className="timer-input" type="text" placeholder="Description (optional)"
            value={description} onChange={e => setDescription(e.target.value)} disabled={loading}
            data-testid="project-desc-input" />
          <select className="timer-input" value={parentProjectId}
            onChange={e => setParentProjectId(e.target.value)} disabled={loading}
            data-testid="parent-project-select">
            <option value="">No parent (top-level)</option>
            {allFlat.map(p => (
              <option key={p.id} value={p.id}>{'— '.repeat(p.depth)}{p.name}</option>
            ))}
          </select>
          <button type="submit" className="btn btn-primary" disabled={loading || !name.trim()}
            data-testid="create-project-btn">
            {loading ? 'Creating…' : 'Create Project'}
          </button>
          {error && <p className="timer-error" role="alert">{error}</p>}
        </form>
      )}

      {deleteWarning && (
        <div className="delete-warning" role="alertdialog" data-testid="delete-warning-dialog">
          <p>
            This project has <strong>{deleteWarning.taskCount}</strong> associated task(s) and{' '}
            <strong>{deleteWarning.subprojectCount}</strong> subproject(s).
            Confirming will disassociate all tasks and permanently remove subprojects.
          </p>
          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(deleteWarning.id, true)}
            data-testid="confirm-force-delete-btn">Disassociate &amp; Delete</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setDeleteWarning(null)}
            data-testid="cancel-force-delete-btn">Cancel</button>
        </div>
      )}

      <div className="project-list" data-testid="project-list">
        {projects.length === 0 && !showForm && (
          <p className="empty-state">No projects yet. Create your first project above.</p>
        )}
        {projects.length > 0 && (
          <ProjectTree projects={projects}
            editingId={editingId} editName={editName} editDesc={editDesc}
            editError={editError} editLoading={editLoading}
            onStartEdit={startEdit} onEditName={setEditName} onEditDesc={setEditDesc}
            onSaveEdit={saveEdit} onCancelEdit={cancelEdit} onDelete={handleDelete}
            onView={id => navigate(`/projects/${id}`)} />
        )}
      </div>
    </div>
  )
}
