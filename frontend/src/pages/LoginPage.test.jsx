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

/** Fill all register form fields including confirm password */
function fillRegisterForm({ displayName = 'Alice', email = 'alice@example.com', password = 'password123', confirmPassword = 'password123' } = {}) {
  fireEvent.click(screen.getByRole('button', { name: 'Register' }))
  fireEvent.change(screen.getByLabelText('Display Name'), { target: { value: displayName } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
  fireEvent.change(screen.getByTestId('confirm-password-input'), { target: { value: confirmPassword } })
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
    expect(screen.getAllByRole('button', { name: 'Log In' }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('button', { name: 'Register' })).toBeInTheDocument()
  })

  it('switches to Register mode and shows Display Name and Confirm Password fields', () => {
    renderLoginPage()
    fireEvent.click(screen.getByRole('button', { name: 'Register' }))
    expect(screen.getByLabelText('Display Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument()
  })

  it('shows error message when registration fails with duplicate email', async () => {
    authApi.register.mockRejectedValueOnce({
      response: { data: { status: 409, message: 'Email already registered: alice@example.com' } }
    })

    renderLoginPage()
    fillRegisterForm()
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
    fillRegisterForm()
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

  // ── US-001: Client-side password validation ───────────────────────────────

  it('shows password field error without API call when password is shorter than 8 characters', async () => {
    renderLoginPage()
    fillRegisterForm({ password: 'short', confirmPassword: 'short' })
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))

    await waitFor(() =>
      expect(screen.getByTestId('error-password')).toHaveTextContent('at least 8 characters')
    )
    expect(authApi.register).not.toHaveBeenCalled()
  })

  it('shows confirm password error without API call when passwords do not match', async () => {
    renderLoginPage()
    fillRegisterForm({ password: 'password123', confirmPassword: 'different99' })
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))

    await waitFor(() =>
      expect(screen.getByTestId('error-confirmPassword')).toHaveTextContent('do not match')
    )
    expect(authApi.register).not.toHaveBeenCalled()
  })

  it('clears confirm password field when switching to login tab and back', () => {
    renderLoginPage()
    fireEvent.click(screen.getByRole('button', { name: 'Register' }))
    fireEvent.change(screen.getByTestId('confirm-password-input'), { target: { value: 'secret' } })

    // Switch to login — confirm field disappears
    const loginBtns = screen.getAllByRole('button', { name: 'Log In' })
    fireEvent.click(loginBtns[0])
    expect(screen.queryByTestId('confirm-password-input')).not.toBeInTheDocument()

    // Switch back — confirm field is empty
    fireEvent.click(screen.getByRole('button', { name: 'Register' }))
    expect(screen.getByTestId('confirm-password-input')).toHaveValue('')
  })

  // ── NFR-003 Usability: field-level inline error display ───────────────────

  it('shows inline email field error when backend returns errors.email', async () => {
    authApi.register.mockRejectedValueOnce({
      response: { data: { errors: { email: 'Email already registered' } } }
    })

    renderLoginPage()
    fillRegisterForm()
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))

    await waitFor(() =>
      expect(screen.getByTestId('error-email')).toHaveTextContent('Email already registered')
    )
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })

  it('shows inline password field error when backend returns errors.password', async () => {
    authApi.register.mockRejectedValueOnce({
      response: { data: { errors: { password: 'Password must be at least 8 characters' } } }
    })

    renderLoginPage()
    fillRegisterForm()
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
    fillRegisterForm()
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
    fillRegisterForm()
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
    fillRegisterForm()
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))

    await waitFor(() => expect(screen.getByTestId('error-email')).toBeInTheDocument())

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
