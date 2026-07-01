import { api } from './authApi'

export function listTemplates() {
  return api.get('/task-templates')
}

export function createTemplate(name, description = null, projectIds = []) {
  return api.post('/task-templates', { name, description, projectIds })
}

export function updateTemplate(id, name, description = null, projectIds = []) {
  return api.put(`/task-templates/${id}`, { name, description, projectIds })
}

export function deleteTemplate(id) {
  return api.delete(`/task-templates/${id}`)
}

export function startTemplate(id) {
  return api.post(`/task-templates/${id}/start`)
}
