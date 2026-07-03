import { useState } from 'react'
import * as authApi from '../api/authApi'
import { AuthContext } from './authCtx'

const TOKEN_KEY = 'tt_token'
const USER_KEY  = 'tt_user'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser]   = useState(() => {
    const stored = localStorage.getItem(USER_KEY)
    return stored ? JSON.parse(stored) : null
  })

  /**
   * Store the auth response (token + user fields including timezone) in
   * localStorage and sync React state.
   * timezone defaults to "UTC" when the field is absent (e.g. old stored sessions).
   */
  function persist(data) {
    const userObj = {
      email:       data.email,
      displayName: data.displayName,
      timezone:    data.timezone ?? 'UTC',
    }
    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(USER_KEY, JSON.stringify(userObj))
    setToken(data.token)
    setUser(userObj)
  }

  async function register(email, password, displayName) {
    const { data } = await authApi.register(email, password, displayName)
    persist(data)
  }

  async function login(email, password) {
    const { data } = await authApi.login(email, password)
    persist(data)
  }

  async function logout() {
    try { await authApi.logout() } catch { /* best-effort */ }
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }

  /**
   * Update the in-memory and localStorage user profile without requiring a
   * re-login.  Used by SettingsPage after a successful PUT /api/users/profile (US-025).
   */
  function updateUser(updates) {
    const updated = { ...user, ...updates }
    localStorage.setItem(USER_KEY, JSON.stringify(updated))
    setUser(updated)
  }

  return (
    <AuthContext.Provider value={{
      token,
      user,
      register,
      login,
      logout,
      updateUser,
      isAuthenticated: !!token,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

