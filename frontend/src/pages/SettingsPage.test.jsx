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

// ─── Timezone selector (US-025) ─────────────────────────────────────────────

describe('SettingsPage — Timezone selector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders the timezone form with a select', () => {
    setup()
    expect(screen.getByTestId('timezone-form')).toBeInTheDocument()
    expect(screen.getByTestId('timezone-select')).toBeInTheDocument()
    expect(screen.getByTestId('timezone-submit-btn')).toBeInTheDocument()
  })

  it('defaults to UTC when no user is logged in', () => {
    setup()
    expect(screen.getByTestId('timezone-select').value).toBe('UTC')
  })

  it('selecting a timezone changes the select value', () => {
    setup()
    fireEvent.change(screen.getByTestId('timezone-select'), { target: { value: 'Europe/Berlin' } })
    expect(screen.getByTestId('timezone-select').value).toBe('Europe/Berlin')
  })

  it('calls updateProfile with selected timezone on submit', async () => {
    authApi.updateProfile.mockResolvedValueOnce({ data: { timezone: 'Europe/Berlin' } })
    setup()
    fireEvent.change(screen.getByTestId('timezone-select'), { target: { value: 'Europe/Berlin' } })
    fireEvent.click(screen.getByTestId('timezone-submit-btn'))
    await waitFor(() =>
      expect(authApi.updateProfile).toHaveBeenCalledWith(null, 'Europe/Berlin')
    )
  })

  it('shows success message after saving timezone', async () => {
    authApi.updateProfile.mockResolvedValueOnce({ data: { timezone: 'Asia/Tokyo' } })
    setup()
    fireEvent.change(screen.getByTestId('timezone-select'), { target: { value: 'Asia/Tokyo' } })
    fireEvent.click(screen.getByTestId('timezone-submit-btn'))
    await waitFor(() =>
      expect(screen.getByTestId('timezone-success')).toBeInTheDocument()
    )
  })

  it('shows error message when updateProfile API fails', async () => {
    authApi.updateProfile.mockRejectedValueOnce({
      response: { data: { message: 'Unknown or invalid timezone: "banana".' } }
    })
    setup()
    fireEvent.change(screen.getByTestId('timezone-select'), { target: { value: 'UTC' } })
    fireEvent.click(screen.getByTestId('timezone-submit-btn'))
    await waitFor(() =>
      expect(screen.getByTestId('timezone-error')).toBeInTheDocument()
    )
  })

  it('success message disappears when timezone select changes again', async () => {
    authApi.updateProfile.mockResolvedValueOnce({ data: { timezone: 'UTC' } })
    setup()
    fireEvent.click(screen.getByTestId('timezone-submit-btn'))
    await waitFor(() => expect(screen.getByTestId('timezone-success')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('timezone-select'), { target: { value: 'Europe/Berlin' } })
    expect(screen.queryByTestId('timezone-success')).not.toBeInTheDocument()
  })

  it('common IANA timezones are available as options', () => {
    setup()
    const select = screen.getByTestId('timezone-select')
    const options = Array.from(select.querySelectorAll('option')).map(o => o.value)
    expect(options).toContain('UTC')
    expect(options).toContain('Europe/Berlin')
    expect(options).toContain('America/New_York')
    expect(options).toContain('Asia/Tokyo')
  })
})

// ─── Change Password ──────────────────────────────────────────────────────────

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
