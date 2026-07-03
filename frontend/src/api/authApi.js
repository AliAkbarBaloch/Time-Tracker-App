import axios from 'axios'

const TOKEN_KEY = 'tt_token'
const REFRESH_KEY = 'tt_refresh'

export const api = axios.create({ baseURL: '/api' })

// Attach JWT to every outgoing request
api.interceptors.request.use(config => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// On 401 from non-auth endpoints, try to refresh silently before redirecting to login
api.interceptors.response.use(
  response => response,
  async error => {
    const url = error.config?.url ?? ''
    if (error.response?.status === 401 && !url.startsWith('/auth/') && !error.config._retried) {
      const storedRefresh = localStorage.getItem(REFRESH_KEY)
      if (storedRefresh) {
        try {
          const res = await api.post('/auth/refresh', { refreshToken: storedRefresh }, { _retried: true })
          const { token, refreshToken: newRefresh } = res.data
          localStorage.setItem(TOKEN_KEY, token)
          if (newRefresh) localStorage.setItem(REFRESH_KEY, newRefresh)
          error.config.headers.Authorization = `Bearer ${token}`
          error.config._retried = true
          return api(error.config)
        } catch {
          // Refresh failed — fall through to clear storage and redirect
        }
      }
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(REFRESH_KEY)
      localStorage.removeItem('tt_user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export function register(email, password, displayName) {
  return api.post('/auth/register', { email, password, displayName }).then(res => {
    if (res.data?.refreshToken) localStorage.setItem(REFRESH_KEY, res.data.refreshToken)
    return res
  })
}

export function login(email, password) {
  return api.post('/auth/login', { email, password }).then(res => {
    if (res.data?.refreshToken) localStorage.setItem(REFRESH_KEY, res.data.refreshToken)
    return res
  })
}

export function logout() {
  const refreshToken = localStorage.getItem(REFRESH_KEY)
  return api.post('/auth/logout', refreshToken ? { refreshToken } : undefined).finally(() => {
    localStorage.removeItem(REFRESH_KEY)
  })
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
