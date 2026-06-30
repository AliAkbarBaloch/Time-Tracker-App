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
