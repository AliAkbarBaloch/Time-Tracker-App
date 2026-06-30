import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export function register(email, password, displayName) {
  return api.post('/auth/register', { email, password, displayName })
}

export function login(email, password) {
  return api.post('/auth/login', { email, password })
}
