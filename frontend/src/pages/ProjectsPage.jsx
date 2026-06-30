import { useState, useEffect, useCallback } from 'react'
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

function ProjectTree({ projects, depth = 0 }) {
  const [collapsed, setCollapsed] = useState({})
  const toggle = id => setCollapsed(c => ({ ...c, [id]: !c[id] }))

  return (
    <ul className="project-tree" style={{ paddingLeft: depth > 0 ? '1.5rem' : 0 }}>
      {projects.map(p => (
        <li key={p.id} className="project-tree-item">
          <div className="project-row">
            {p.subprojects && p.subprojects.length > 0 && (
              <button
                className="btn-collapse"
                onClick={() => toggle(p.id)}
                data-testid={`collapse-btn-${p.id}`}
                aria-label={collapsed[p.id] ? 'Expand' : 'Collapse'}
              >
                {collapsed[p.id] ? '▶' : '▼'}
              </button>
            )}
            <span className="project-name" data-testid={`project-name-${p.id}`}>{p.name}</span>
            {p.description && (
              <span className="project-description">{p.description}</span>
            )}
            <span className="project-total" data-testid={`project-total-${p.id}`}>
              {formatDuration(p.totalSeconds)}
            </span>
          </div>
          {p.subprojects && p.subprojects.length > 0 && !collapsed[p.id] && (
            <ProjectTree projects={p.subprojects} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  )
}

export default function ProjectsPage() {
  const [projects, setProjects]               = useState([])
  const [showForm, setShowForm]               = useState(false)
  const [name, setName]                       = useState('')
  const [description, setDescription]         = useState('')
  const [parentProjectId, setParentProjectId] = useState('')
  const [loading, setLoading]                 = useState(false)
  const [error, setError]                     = useState('')

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
      await projectApi.createProject(
        name,
        description || null,
        parentProjectId ? Number(parentProjectId) : null
      )
      setName(''); setDescription(''); setParentProjectId('')
      setShowForm(false)
      fetchProjects()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create project')
    } finally {
      setLoading(false)
    }
  }

  const allFlat = flattenProjects(projects)

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Projects</h2>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => { setShowForm(f => !f); setError('') }}
          data-testid="new-project-btn"
        >
          {showForm ? 'Cancel' : '+ New Project'}
        </button>
      </div>

      {showForm && (
        <form className="project-form" onSubmit={handleCreate} data-testid="project-form">
          <input
            className="timer-input"
            type="text"
            placeholder="Project name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            disabled={loading}
            data-testid="project-name-input"
          />
          <input
            className="timer-input"
            type="text"
            placeholder="Description (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            disabled={loading}
            data-testid="project-desc-input"
          />
          <select
            className="timer-input"
            value={parentProjectId}
            onChange={e => setParentProjectId(e.target.value)}
            disabled={loading}
            data-testid="parent-project-select"
          >
            <option value="">No parent (top-level)</option>
            {allFlat.map(p => (
              <option key={p.id} value={p.id}>
                {'— '.repeat(p.depth)}{p.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !name.trim()}
            data-testid="create-project-btn"
          >
            {loading ? 'Creating…' : 'Create Project'}
          </button>
          {error && <p className="timer-error" role="alert">{error}</p>}
        </form>
      )}

      <div className="project-list" data-testid="project-list">
        {projects.length === 0 && !showForm && (
          <p className="empty-state">No projects yet. Create your first project above.</p>
        )}
        {projects.length > 0 && (
          <ProjectTree projects={projects} />
        )}
      </div>
    </div>
  )
}
