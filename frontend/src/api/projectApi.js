import { api } from './authApi'

export function listProjects() {
  return api.get('/projects')
}

export function createProject(name, description = null) {
  return api.post('/projects', { name, description })
}
