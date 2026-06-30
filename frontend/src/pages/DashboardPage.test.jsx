import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import DashboardPage from './DashboardPage'
import { AuthProvider } from '../context/AuthContext'
import * as taskApi from '../api/taskApi'

vi.mock('../api/taskApi')

function setup() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <DashboardPage />
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('shows Start button when no active task', async () => {
    taskApi.getActiveTask.mockResolvedValueOnce({ status: 204, data: null })
    setup()
    await waitFor(() =>
      expect(screen.getByTestId('start-btn')).toBeInTheDocument()
    )
  })

  it('shows elapsed timer and Stop button when active task is loaded on mount', async () => {
    taskApi.getActiveTask.mockResolvedValueOnce({
      status: 200,
      data: { id: 1, description: 'Study', startTime: new Date(Date.now() - 5000).toISOString(), endTime: null, running: true }
    })
    setup()
    await waitFor(() => {
      expect(screen.getByTestId('elapsed')).toBeInTheDocument()
      expect(screen.getByTestId('stop-btn')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('start-btn')).not.toBeInTheDocument()
  })

  it('calls startTask API and shows Stop button on Start click', async () => {
    taskApi.getActiveTask.mockResolvedValueOnce({ status: 204, data: null })
    taskApi.startTask.mockResolvedValueOnce({
      data: { id: 2, description: null, startTime: new Date().toISOString(), endTime: null, running: true }
    })

    setup()
    await waitFor(() => screen.getByTestId('start-btn'))
    fireEvent.click(screen.getByTestId('start-btn'))

    await waitFor(() => expect(taskApi.startTask).toHaveBeenCalledWith(null))
    await waitFor(() => expect(screen.getByTestId('stop-btn')).toBeInTheDocument())
  })

  it('calls stopTask API and shows Start button after stop', async () => {
    taskApi.getActiveTask.mockResolvedValueOnce({
      status: 200,
      data: { id: 3, description: null, startTime: new Date().toISOString(), endTime: null, running: true }
    })
    taskApi.stopTask.mockResolvedValueOnce({ data: {} })

    setup()
    await waitFor(() => screen.getByTestId('stop-btn'))
    fireEvent.click(screen.getByTestId('stop-btn'))

    await waitFor(() => expect(taskApi.stopTask).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByTestId('start-btn')).toBeInTheDocument())
  })

  it('shows error when start fails with 409', async () => {
    taskApi.getActiveTask.mockResolvedValueOnce({ status: 204, data: null })
    taskApi.startTask.mockRejectedValueOnce({
      response: { data: { message: 'A timer is already running.' } }
    })

    setup()
    await waitFor(() => screen.getByTestId('start-btn'))
    fireEvent.click(screen.getByTestId('start-btn'))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('already running')
    )
  })

  it('passes description to startTask when typed', async () => {
    taskApi.getActiveTask.mockResolvedValueOnce({ status: 204, data: null })
    taskApi.startTask.mockResolvedValueOnce({
      data: { id: 4, description: 'Coding', startTime: new Date().toISOString(), endTime: null, running: true }
    })

    setup()
    await waitFor(() => screen.getByTestId('start-btn'))
    fireEvent.change(screen.getByPlaceholderText('What are you working on?'), { target: { value: 'Coding' } })
    fireEvent.click(screen.getByTestId('start-btn'))

    await waitFor(() => expect(taskApi.startTask).toHaveBeenCalledWith('Coding'))
  })

  it('shows error when stop fails', async () => {
    taskApi.getActiveTask.mockResolvedValueOnce({
      status: 200,
      data: { id: 5, description: null, startTime: new Date().toISOString(), endTime: null, running: true }
    })
    taskApi.stopTask.mockRejectedValueOnce({
      response: { data: { message: 'No timer is currently running.' } }
    })

    setup()
    await waitFor(() => screen.getByTestId('stop-btn'))
    fireEvent.click(screen.getByTestId('stop-btn'))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('No timer')
    )
  })
})
