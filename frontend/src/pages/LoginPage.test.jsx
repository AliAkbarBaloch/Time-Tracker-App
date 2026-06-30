import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import LoginPage from './LoginPage'
import { AuthProvider } from '../context/AuthContext'
import * as authApi from '../api/authApi'

vi.mock('../api/authApi')

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders the TimeTracker brand name', () => {
    renderLoginPage()
    expect(screen.getByText('TimeTracker')).toBeInTheDocument()
  })

  it('shows email and password fields', () => {
    renderLoginPage()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('shows Log In and Register tabs', () => {
    renderLoginPage()
    // Both the tab and the submit button are labelled "Log In" in login mode
    expect(screen.getAllByRole('button', { name: 'Log In' }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('button', { name: 'Register' })).toBeInTheDocument()
  })

  it('switches to Register mode and shows Display Name field', () => {
    renderLoginPage()
    fireEvent.click(screen.getByRole('button', { name: 'Register' }))
    expect(screen.getByLabelText('Display Name')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument()
  })

  it('shows error message when registration fails with duplicate email', async () => {
    authApi.register.mockRejectedValueOnce({
      response: { data: { status: 409, message: 'Email already registered: alice@example.com' } }
    })

    renderLoginPage()
    fireEvent.click(screen.getByRole('button', { name: 'Register' }))
    fireEvent.change(screen.getByLabelText('Display Name'), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alice@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Email already registered')
    )
  })

  it('calls register API with correct payload on form submit', async () => {
    authApi.register.mockResolvedValueOnce({
      data: { token: 'tok', email: 'alice@example.com', displayName: 'Alice' }
    })

    renderLoginPage()
    fireEvent.click(screen.getByRole('button', { name: 'Register' }))
    fireEvent.change(screen.getByLabelText('Display Name'), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alice@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))

    await waitFor(() =>
      expect(authApi.register).toHaveBeenCalledWith('alice@example.com', 'password123', 'Alice')
    )
  })

  it('calls login API with correct payload on login submit', async () => {
    authApi.login.mockResolvedValueOnce({
      data: { token: 'tok', email: 'alice@example.com', displayName: 'Alice' }
    })

    renderLoginPage()
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alice@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    // In login mode both the tab and submit are labelled "Log In" — click the last one (submit)
    const loginBtns = screen.getAllByRole('button', { name: 'Log In' })
    fireEvent.click(loginBtns[loginBtns.length - 1])

    await waitFor(() =>
      expect(authApi.login).toHaveBeenCalledWith('alice@example.com', 'password123')
    )
  })

  it('shows error when login fails with bad credentials', async () => {
    authApi.login.mockRejectedValueOnce({
      response: { data: { status: 401, message: 'Invalid email or password' } }
    })

    renderLoginPage()
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alice@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpass' } })
    const loginBtns = screen.getAllByRole('button', { name: 'Log In' })
    fireEvent.click(loginBtns[loginBtns.length - 1])

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password')
    )
  })
})
