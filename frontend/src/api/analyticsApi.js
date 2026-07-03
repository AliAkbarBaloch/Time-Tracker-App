import { api } from './authApi'

export function getHeatmap(year) {
  return api.get('/analytics/heatmap', { params: { year } })
}

export function getWeeklyPattern(weeks = 12, year) {
  return api.get('/analytics/weekly-pattern', { params: { weeks, year } })
}

export function getSharedBreakdown(weeks = 12, year) {
  return api.get('/analytics/shared-breakdown', { params: { weeks, year } })
}
