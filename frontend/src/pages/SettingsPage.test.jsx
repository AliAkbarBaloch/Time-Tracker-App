import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SettingsPage from './SettingsPage'
import { AuthProvider } from '../context/AuthContext'
import * as authApi from '../api/authApi'

vi.mock('../api/authApi')

function setup() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <SettingsPage />
      </AuthProvider>
    </MemoryRouter>
  )
}

function fill(current, next, confirm) {
  fireEvent.change(screen.getByTestId('current-password-input'), { target: { value: current } })
  fireEvent.change(screen.getByTestId('new-password-input'),     { target: { value: next } })
  fireEvent.change(screen.getByTestId('confirm-password-input'), { target: { value: confirm } })
}

describe('SettingsPage — Change Password', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders the change-password form', () => {
    setup()
    expect(screen.getByTestId('change-password-form')).toBeInTheDocument()
    expect(screen.getByTestId('current-password-input')).toBeInTheDocument()
    expect(screen.getByTestId('new-password-input')).toBeInTheDocument()
    expect(screen.getByTestId('confirm-password-input')).toBeInTheDocument()
    expect(screen.getByTestId('submit-btn')).toBeInTheDocument()
  })

  it('shows error when new password is too short', async () => {
    setup()
    fill('oldpass', 'short', 'short')
    fireEvent.click(screen.getByTestId('submit-btn'))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('at least 8 characters')
    )
    expect(authApi.changePassword).not.toHaveBeenCalled()
  })

  it('shows error when new passwords do not match', async () => {
    setup()
    fill('oldpass', 'newpass123', 'different1')
    fireEvent.click(screen.getByTestId('submit-btn'))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('do not match')
    )
    expect(authApi.changePassword).not.toHaveBeenCalled()
  })

  it('calls changePassword API with correct values', async () => {
    authApi.changePassword.mockResolvedValueOnce({})
    authApi.logout.mockResolvedValueOnce({})
    setup()
    fill('currentPass', 'newValidPass1', 'newValidPass1')
    fireEvent.click(screen.getByTestId('submit-btn'))
    await waitFor(() =>
      expect(authApi.changePassword).toHaveBeenCalledWith('currentPass', 'newValidPass1')
    )
  })

  it('shows error when API returns 401 wrong current password', async () => {
    authApi.changePassword.mockRejectedValueOnce({
      response: { data: { message: 'Current password is incorrect.' } }
    })
    setup()
    fill('wrongPass', 'newValidPass1', 'newValidPass1')
    fireEvent.click(screen.getByTestId('submit-btn'))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('incorrect')
    )
  })
})
