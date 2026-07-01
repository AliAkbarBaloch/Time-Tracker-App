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

/** GET /api/projects/{id}/summary with optional date range and user filter (US-023). */
export function getProjectSummary(id, from = null, to = null, userId = null) {
  const params = {}
  if (from)   params.from    = from
  if (to)     params.to      = to
  if (userId) params.userId  = userId
  return api.get(`/projects/${id}/summary`, { params })
}

// ── US-022: Project Sharing ───────────────────────────────────────────────────

/** GET /api/projects/{id}/members — list all members (accessible to any member). */
export function getMembers(projectId) {
  return api.get(`/projects/${projectId}/members`)
}

/** POST /api/projects/{id}/members — invite a registered user by email (OWNER only). */
export function inviteMember(projectId, email) {
  return api.post(`/projects/${projectId}/members`, { email })
}

/** DELETE /api/projects/{id}/members/{userId} — remove a member (OWNER only). */
export function removeMember(projectId, userId) {
  return api.delete(`/projects/${projectId}/members/${userId}`)
}
