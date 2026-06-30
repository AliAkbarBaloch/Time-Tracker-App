import axios from 'axios'

const TOKEN_KEY = 'tt_token'

export const api = axios.create({ baseURL: '/api' })

// Attach JWT to every outgoing request
api.interceptors.request.use(config => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export function register(email, password, displayName) {
  return api.post('/auth/register', { email, password, displayName })
}

export function login(email, password) {
  return api.post('/auth/login', { email, password })
}

export function logout() {
  return api.post('/auth/logout')
}
