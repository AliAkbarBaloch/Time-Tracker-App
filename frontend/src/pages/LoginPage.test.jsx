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

  // ── NFR-003 Usability: field-level inline error display ───────────────────

  it('shows inline email field error when backend returns errors.email', async () => {
    authApi.register.mockRejectedValueOnce({
      response: { data: { errors: { email: 'Email already registered' } } }
    })

    renderLoginPage()
    fireEvent.click(screen.getByRole('button', { name: 'Register' }))
    fireEvent.change(screen.getByLabelText('Display Name'), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alice@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))

    await waitFor(() =>
      expect(screen.getByTestId('error-email')).toHaveTextContent('Email already registered')
    )
    // General error banner should NOT show
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })

  it('shows inline password field error when backend returns errors.password', async () => {
    authApi.register.mockRejectedValueOnce({
      response: { data: { errors: { password: 'Password must be at least 8 characters' } } }
    })

    renderLoginPage()
    fireEvent.click(screen.getByRole('button', { name: 'Register' }))
    fireEvent.change(screen.getByLabelText('Display Name'), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alice@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))

    await waitFor(() =>
      expect(screen.getByTestId('error-password')).toHaveTextContent('Password must be at least 8 characters')
    )
  })

  it('shows inline displayName field error when backend returns errors.displayName', async () => {
    authApi.register.mockRejectedValueOnce({
      response: { data: { errors: { displayName: 'Display name is required' } } }
    })

    renderLoginPage()
    fireEvent.click(screen.getByRole('button', { name: 'Register' }))
    fireEvent.change(screen.getByLabelText('Display Name'), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alice@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))

    await waitFor(() =>
      expect(screen.getByTestId('error-displayName')).toHaveTextContent('Display name is required')
    )
  })

  it('shows multiple field errors simultaneously when backend returns multiple errors', async () => {
    authApi.register.mockRejectedValueOnce({
      response: { data: { errors: { email: 'Valid email required', password: 'Too short' } } }
    })

    renderLoginPage()
    fireEvent.click(screen.getByRole('button', { name: 'Register' }))
    fireEvent.change(screen.getByLabelText('Display Name'), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alice@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))

    await waitFor(() => {
      expect(screen.getByTestId('error-email')).toHaveTextContent('Valid email required')
      expect(screen.getByTestId('error-password')).toHaveTextContent('Too short')
    })
  })

  it('clears field errors when switching between login and register tabs', async () => {
    authApi.register.mockRejectedValueOnce({
      response: { data: { errors: { email: 'Email already exists' } } }
    })

    renderLoginPage()
    fireEvent.click(screen.getByRole('button', { name: 'Register' }))
    fireEvent.change(screen.getByLabelText('Display Name'), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alice@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))

    await waitFor(() => expect(screen.getByTestId('error-email')).toBeInTheDocument())

    // Switch to login tab — field errors should clear
    const loginBtns = screen.getAllByRole('button', { name: 'Log In' })
    fireEvent.click(loginBtns[0])
    expect(screen.queryByTestId('error-email')).not.toBeInTheDocument()
  })

  it('shows general error banner (not field errors) for non-validation failures', async () => {
    authApi.login.mockRejectedValueOnce({
      response: { data: { message: 'Something went wrong on server' } }
    })

    renderLoginPage()
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alice@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    const loginBtns = screen.getAllByRole('button', { name: 'Log In' })
    fireEvent.click(loginBtns[loginBtns.length - 1])

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong on server')
    )
    expect(screen.queryByTestId('error-email')).not.toBeInTheDocument()
  })
})
