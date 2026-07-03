import { api } from './authApi'

export function startTask(description = null) {
  return api.post('/tasks/start', description ? { description } : {})
}

export function stopTask() {
  return api.post('/tasks/stop')
}

export function getActiveTask() {
  return api.get('/tasks/active')
}

export function listTasks(from = null, to = null, search = null, projectId = null, page = 0, size = 20) {
  const params = {}
  if (from) params.from = from
  if (to) params.to = to
  if (search) params.search = search
  if (projectId) params.projectId = projectId
  params.page = page
  params.size = size
  return api.get('/tasks', { params })
}

export function createTask(description, startTime, endTime, projectIds = null) {
  return api.post('/tasks', { description, startTime, endTime, projectIds })
}

export function updateTask(id, description, startTime, endTime, projectIds = null) {
  return api.put(`/tasks/${id}`, { description, startTime, endTime, projectIds })
}

export function deleteTask(id) {
  return api.delete(`/tasks/${id}`)
}
