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

export function listTasks() {
  return api.get('/tasks')
}

export function createTask(description, startTime, endTime, projectIds = null) {
  return api.post('/tasks', { description, startTime, endTime, projectIds })
}

export function updateTask(id, description, startTime, endTime, projectIds = null) {
  return api.put(`/tasks/${id}`, { description, startTime, endTime, projectIds })
}
