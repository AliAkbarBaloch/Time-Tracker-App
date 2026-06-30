import { useState, useEffect, useCallback } from 'react'
import * as projectApi from '../api/projectApi'

export default function ProjectsPage() {
  const [projects, setProjects]       = useState([])
  const [showForm, setShowForm]       = useState(false)
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')

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
      await projectApi.createProject(name, description || null)
      setName('')
      setDescription('')
      setShowForm(false)
      fetchProjects()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create project')
    } finally {
      setLoading(false)
    }
  }

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
        {projects.map(p => (
          <div key={p.id} className="project-card">
            <div className="project-row">
              <span className="project-name">{p.name}</span>
              {p.description && (
                <span className="project-description">{p.description}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
