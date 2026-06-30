import { api } from './authApi'

export function listProjects() {
  return api.get('/projects')
}

export function createProject(name, description = null, parentProjectId = null) {
  return api.post('/projects', { name, description, parentProjectId })
}

export function updateProject(id, name, description = null) {
  return api.put(`/projects/${id}`, { name, description })
}

export function deleteProject(id, force = false) {
  return api.delete(`/projects/${id}?force=${force}`)
}
