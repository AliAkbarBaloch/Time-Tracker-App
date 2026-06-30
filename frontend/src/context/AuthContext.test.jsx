import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'
import { MemoryRouter } from 'react-router-dom'
import * as authApi from '../api/authApi'

vi.mock('../api/authApi')

function TestComponent() {
  const { user, isAuthenticated, register, login, logout } = useAuth()
  return (
    <div>
      <span data-testid="auth">{isAuthenticated ? 'yes' : 'no'}</span>
      <span data-testid="user">{user?.displayName ?? 'none'}</span>
      <button onClick={() => register('a@b.com', 'pass1234', 'Alice')}>reg</button>
      <button onClick={() => login('a@b.com', 'pass1234')}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  )
}

function setup() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('starts unauthenticated with no user', () => {
    setup()
    expect(screen.getByTestId('auth').textContent).toBe('no')
    expect(screen.getByTestId('user').textContent).toBe('none')
  })

  it('becomes authenticated after register and stores token', async () => {
    authApi.register.mockResolvedValueOnce({
      data: { token: 'jwt-tok', email: 'a@b.com', displayName: 'Alice' }
    })
    setup()
    await act(async () => {
      screen.getByRole('button', { name: 'reg' }).click()
    })
    expect(screen.getByTestId('auth').textContent).toBe('yes')
    expect(screen.getByTestId('user').textContent).toBe('Alice')
    expect(localStorage.getItem('tt_token')).toBe('jwt-tok')
  })

  it('becomes authenticated after login and stores token', async () => {
    authApi.login.mockResolvedValueOnce({
      data: { token: 'login-tok', email: 'a@b.com', displayName: 'Alice' }
    })
    setup()
    await act(async () => {
      screen.getByRole('button', { name: 'login' }).click()
    })
    expect(screen.getByTestId('auth').textContent).toBe('yes')
    expect(screen.getByTestId('user').textContent).toBe('Alice')
    expect(localStorage.getItem('tt_token')).toBe('login-tok')
  })

  it('clears state and localStorage on logout', async () => {
    authApi.register.mockResolvedValueOnce({
      data: { token: 'jwt-tok', email: 'a@b.com', displayName: 'Alice' }
    })
    setup()
    await act(async () => { screen.getByRole('button', { name: 'reg' }).click() })
    await act(async () => { screen.getByRole('button', { name: 'logout' }).click() })
    expect(screen.getByTestId('auth').textContent).toBe('no')
    expect(localStorage.getItem('tt_token')).toBeNull()
  })
})
