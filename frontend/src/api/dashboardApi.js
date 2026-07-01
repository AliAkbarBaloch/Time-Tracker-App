import { api } from './authApi'

export function getDashboardSummary() {
  return api.get('/dashboard/summary')
}
