import { createContext, useContext, useState } from 'react'
import * as authApi from '../api/authApi'

const AuthContext = createContext(null)

const TOKEN_KEY = 'tt_token'
const USER_KEY = 'tt_user'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem(USER_KEY)
    return stored ? JSON.parse(stored) : null
  })

  function persist(data) {
    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(USER_KEY, JSON.stringify({ email: data.email, displayName: data.displayName }))
    setToken(data.token)
    setUser({ email: data.email, displayName: data.displayName })
  }

  async function register(email, password, displayName) {
    const { data } = await authApi.register(email, password, displayName)
    persist(data)
  }

  async function login(email, password) {
    const { data } = await authApi.login(email, password)
    persist(data)
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ token, user, register, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
