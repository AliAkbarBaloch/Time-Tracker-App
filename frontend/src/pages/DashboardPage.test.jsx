import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import DashboardPage from './DashboardPage'
import { AuthProvider } from '../context/AuthContext'
import { TimerProvider } from '../context/TimerContext'
import * as taskApi from '../api/taskApi'

vi.mock('../api/taskApi')

const PAST_START = new Date(Date.now() - 7200000).toISOString()
const PAST_END   = new Date(Date.now() - 3600000).toISOString()

function setup() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <TimerProvider>
          <DashboardPage />
        </TimerProvider>
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    taskApi.listTasks.mockResolvedValue({ data: [] })
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
      data: { id: 1, description: 'Study', startTime: new Date(Date.now() - 5000).toISOString(), endTime: null, running: true, projects: [] }
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
      data: { id: 2, description: null, startTime: new Date().toISOString(), endTime: null, running: true, projects: [] }
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
      data: { id: 3, description: null, startTime: new Date().toISOString(), endTime: null, running: true, projects: [] }
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
      data: { id: 4, description: 'Coding', startTime: new Date().toISOString(), endTime: null, running: true, projects: [] }
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
      data: { id: 5, description: null, startTime: new Date().toISOString(), endTime: null, running: true, projects: [] }
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

  // --- Today section (US-014) ---

  it('renders today section', async () => {
    taskApi.getActiveTask.mockResolvedValueOnce({ status: 204, data: null })
    setup()
    await waitFor(() =>
      expect(screen.getByTestId('today-section')).toBeInTheDocument()
    )
  })

  it('shows empty state when no tasks today', async () => {
    taskApi.getActiveTask.mockResolvedValueOnce({ status: 204, data: null })
    taskApi.listTasks.mockResolvedValue({ data: [] })
    setup()
    await waitFor(() =>
      expect(screen.getByTestId('today-empty')).toBeInTheDocument()
    )
  })

  it('renders tasks for today with description and duration', async () => {
    taskApi.getActiveTask.mockResolvedValueOnce({ status: 204, data: null })
    taskApi.listTasks.mockResolvedValue({
      data: [{ id: 10, description: 'Study', startTime: PAST_START, endTime: PAST_END, running: false, projects: [] }]
    })
    setup()
    await waitFor(() =>
      expect(screen.getByTestId('today-task-10')).toBeInTheDocument()
    )
    expect(screen.getByText('Study')).toBeInTheDocument()
  })

  it('shows non-zero daily total when tasks exist', async () => {
    taskApi.getActiveTask.mockResolvedValueOnce({ status: 204, data: null })
    taskApi.listTasks.mockResolvedValue({
      data: [{ id: 11, description: 'Work', startTime: PAST_START, endTime: PAST_END, running: false, projects: [] }]
    })
    setup()
    await waitFor(() => {
      const total = screen.getByTestId('daily-total')
      expect(total.textContent).not.toBe('00:00:00')
    })
  })

  it('highlights running task in today list with running class', async () => {
    taskApi.getActiveTask.mockResolvedValueOnce({
      status: 200,
      data: { id: 20, description: 'Active', startTime: new Date(Date.now() - 5000).toISOString(), endTime: null, running: true, projects: [] }
    })
    taskApi.listTasks.mockResolvedValue({
      data: [{ id: 20, description: 'Active', startTime: new Date(Date.now() - 5000).toISOString(), endTime: null, running: true, projects: [] }]
    })
    setup()
    await waitFor(() => {
      const row = screen.getByTestId('today-task-20')
      expect(row.className).toContain('task-row--running')
    })
  })

  it('shows elapsed time for running task duration in today list', async () => {
    taskApi.getActiveTask.mockResolvedValueOnce({
      status: 200,
      data: { id: 21, description: 'Active', startTime: new Date(Date.now() - 5000).toISOString(), endTime: null, running: true, projects: [] }
    })
    taskApi.listTasks.mockResolvedValue({
      data: [{ id: 21, description: 'Active', startTime: new Date(Date.now() - 5000).toISOString(), endTime: null, running: true, projects: [] }]
    })
    setup()
    await waitFor(() => {
      const dur = screen.getByTestId('today-task-duration-21')
      expect(dur.textContent).not.toBe('—')
    })
  })

  it('refreshes today tasks after timer is started', async () => {
    taskApi.getActiveTask.mockResolvedValueOnce({ status: 204, data: null })
    taskApi.startTask.mockResolvedValueOnce({
      data: { id: 30, description: 'New task', startTime: new Date().toISOString(), endTime: null, running: true, projects: [] }
    })
    taskApi.listTasks
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({
        data: [{ id: 30, description: 'New task', startTime: new Date().toISOString(), endTime: null, running: true, projects: [] }]
      })

    setup()
    await waitFor(() => screen.getByTestId('start-btn'))
    fireEvent.click(screen.getByTestId('start-btn'))

    await waitFor(() =>
      expect(screen.getByTestId('today-task-30')).toBeInTheDocument()
    )
  })

  it('refreshes today tasks after timer is stopped', async () => {
    taskApi.getActiveTask.mockResolvedValueOnce({
      status: 200,
      data: { id: 40, description: 'Running', startTime: PAST_START, endTime: null, running: true, projects: [] }
    })
    taskApi.stopTask.mockResolvedValueOnce({ data: {} })
    taskApi.listTasks
      .mockResolvedValueOnce({
        data: [{ id: 40, description: 'Running', startTime: PAST_START, endTime: null, running: true, projects: [] }]
      })
      .mockResolvedValueOnce({
        data: [{ id: 40, description: 'Running', startTime: PAST_START, endTime: PAST_END, running: false, projects: [] }]
      })

    setup()
    await waitFor(() => screen.getByTestId('stop-btn'))
    fireEvent.click(screen.getByTestId('stop-btn'))

    await waitFor(() => expect(taskApi.listTasks).toHaveBeenCalledTimes(2))
  })

  it('shows task project names in today list', async () => {
    taskApi.getActiveTask.mockResolvedValueOnce({ status: 204, data: null })
    taskApi.listTasks.mockResolvedValue({
      data: [{
        id: 50, description: 'Study', startTime: PAST_START, endTime: PAST_END, running: false,
        projects: [{ id: 100, name: 'Thesis' }]
      }]
    })
    setup()
    await waitFor(() =>
      expect(screen.getByText('Thesis')).toBeInTheDocument()
    )
  })
})
