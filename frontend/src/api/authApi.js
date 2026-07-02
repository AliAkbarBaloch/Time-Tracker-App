import axios from 'axios'

const TOKEN_KEY = 'tt_token'

export const api = axios.create({ baseURL: '/api' })

// Attach JWT to every outgoing request
api.interceptors.request.use(config => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// On 401 from non-auth endpoints, clear stored credentials and redirect to login
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      const url = error.config?.url ?? ''
      if (!url.startsWith('/auth/')) {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem('tt_user')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export function register(email, password, displayName) {
  return api.post('/auth/register', { email, password, displayName })
}

export function login(email, password) {
  return api.post('/auth/login', { email, password })
}

export function logout() {
  return api.post('/auth/logout')
}

export function changePassword(currentPassword, newPassword) {
  return api.put('/auth/password', { currentPassword, newPassword })
}

// ── US-025: User profile ──────────────────────────────────────────────────────

/** GET /api/users/profile — returns { id, email, displayName, timezone, createdAt }. */
export function getProfile() {
  return api.get('/users/profile')
}

/**
 * PUT /api/users/profile — update displayName and/or timezone.
 * Pass null for fields you do not want to change.
 * Returns 400 if timezone is not a valid IANA identifier.
 */
export function updateProfile(displayName = null, timezone = null) {
  return api.put('/users/profile', { displayName, timezone })
}
