import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import DashboardPage from './DashboardPage'
import { AuthProvider } from '../context/AuthContext'
import { TimerProvider } from '../context/TimerContext'
import * as taskApi from '../api/taskApi'
import * as dashboardApi from '../api/dashboardApi'

vi.mock('../api/taskApi')
vi.mock('../api/dashboardApi')

const EMPTY_SUMMARY = { todaySeconds: 0, weekSeconds: 0, runningTask: null, topProjects: [] }

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
    dashboardApi.getDashboardSummary.mockResolvedValue({ data: EMPTY_SUMMARY })
  })

  // ── Timer controls ────────────────────────────────────────

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

  it('shows error when start fails', async () => {
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

  // ── Summary cards ─────────────────────────────────────────

  it('renders dashboard summary section', async () => {
    taskApi.getActiveTask.mockResolvedValueOnce({ status: 204, data: null })
    setup()
    await waitFor(() =>
      expect(screen.getByTestId('dashboard-summary')).toBeInTheDocument()
    )
  })

  it('shows today seconds as 00:00:00 when no tasks today', async () => {
    taskApi.getActiveTask.mockResolvedValueOnce({ status: 204, data: null })
    setup()
    await waitFor(() =>
      expect(screen.getByTestId('today-seconds')).toHaveTextContent('00:00:00')
    )
  })

  it('shows week seconds as 00:00:00 when no tasks this week', async () => {
    taskApi.getActiveTask.mockResolvedValueOnce({ status: 204, data: null })
    setup()
    await waitFor(() =>
      expect(screen.getByTestId('week-seconds')).toHaveTextContent('00:00:00')
    )
  })

  it('displays non-zero today seconds from summary', async () => {
    taskApi.getActiveTask.mockResolvedValueOnce({ status: 204, data: null })
    dashboardApi.getDashboardSummary.mockResolvedValueOnce({
      data: { todaySeconds: 3600, weekSeconds: 7200, runningTask: null, topProjects: [] }
    })
    setup()
    await waitFor(() =>
      expect(screen.getByTestId('today-seconds')).toHaveTextContent('01:00:00')
    )
  })

  it('displays non-zero week seconds from summary', async () => {
    taskApi.getActiveTask.mockResolvedValueOnce({ status: 204, data: null })
    dashboardApi.getDashboardSummary.mockResolvedValueOnce({
      data: { todaySeconds: 0, weekSeconds: 7200, runningTask: null, topProjects: [] }
    })
    setup()
    await waitFor(() =>
      expect(screen.getByTestId('week-seconds')).toHaveTextContent('02:00:00')
    )
  })

  // ── Top projects ──────────────────────────────────────────

  it('shows empty state when no top projects', async () => {
    taskApi.getActiveTask.mockResolvedValueOnce({ status: 204, data: null })
    setup()
    await waitFor(() =>
      expect(screen.getByTestId('top-projects-empty')).toBeInTheDocument()
    )
  })

  it('renders top projects list when summary has projects', async () => {
    taskApi.getActiveTask.mockResolvedValueOnce({ status: 204, data: null })
    dashboardApi.getDashboardSummary.mockResolvedValueOnce({
      data: {
        todaySeconds: 0,
        weekSeconds: 3600,
        runningTask: null,
        topProjects: [
          { id: 1, name: 'Alpha', weekSeconds: 3600 },
          { id: 2, name: 'Beta',  weekSeconds: 1800 }
        ]
      }
    })
    setup()
    await waitFor(() => {
      expect(screen.getByTestId('top-project-1')).toBeInTheDocument()
      expect(screen.getByTestId('top-project-2')).toBeInTheDocument()
    })
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('does not show top-projects-empty when projects exist', async () => {
    taskApi.getActiveTask.mockResolvedValueOnce({ status: 204, data: null })
    dashboardApi.getDashboardSummary.mockResolvedValueOnce({
      data: { todaySeconds: 0, weekSeconds: 0, runningTask: null, topProjects: [{ id: 5, name: 'X', weekSeconds: 600 }] }
    })
    setup()
    await waitFor(() => expect(screen.getByTestId('top-project-5')).toBeInTheDocument())
    expect(screen.queryByTestId('top-projects-empty')).not.toBeInTheDocument()
  })

  // ── Running task info ─────────────────────────────────────

  it('shows running task info block when summary has runningTask', async () => {
    taskApi.getActiveTask.mockResolvedValueOnce({
      status: 200,
      data: { id: 99, description: 'Deep work', startTime: new Date().toISOString(), endTime: null, running: true, projects: [] }
    })
    dashboardApi.getDashboardSummary.mockResolvedValueOnce({
      data: { todaySeconds: 0, weekSeconds: 0, runningTask: { id: 99, description: 'Deep work' }, topProjects: [] }
    })
    setup()
    await waitFor(() =>
      expect(screen.getByTestId('running-task-info')).toBeInTheDocument()
    )
    expect(screen.getByTestId('running-task-name')).toHaveTextContent('Deep work')
  })

  it('does not show running task info when runningTask is null', async () => {
    taskApi.getActiveTask.mockResolvedValueOnce({ status: 204, data: null })
    setup()
    await waitFor(() =>
      expect(screen.getByTestId('dashboard-summary')).toBeInTheDocument()
    )
    expect(screen.queryByTestId('running-task-info')).not.toBeInTheDocument()
  })

  // ── Refresh after timer actions ───────────────────────────

  it('refreshes summary after timer started', async () => {
    taskApi.getActiveTask.mockResolvedValueOnce({ status: 204, data: null })
    taskApi.startTask.mockResolvedValueOnce({
      data: { id: 30, description: 'New', startTime: new Date().toISOString(), endTime: null, running: true, projects: [] }
    })
    dashboardApi.getDashboardSummary
      .mockResolvedValueOnce({ data: EMPTY_SUMMARY })
      .mockResolvedValueOnce({ data: EMPTY_SUMMARY })

    setup()
    await waitFor(() => screen.getByTestId('start-btn'))
    fireEvent.click(screen.getByTestId('start-btn'))
    await waitFor(() => expect(dashboardApi.getDashboardSummary).toHaveBeenCalledTimes(2))
  })

  it('refreshes summary after timer stopped', async () => {
    taskApi.getActiveTask.mockResolvedValueOnce({
      status: 200,
      data: { id: 40, description: 'Running', startTime: new Date().toISOString(), endTime: null, running: true, projects: [] }
    })
    taskApi.stopTask.mockResolvedValueOnce({ data: {} })
    dashboardApi.getDashboardSummary
      .mockResolvedValueOnce({ data: EMPTY_SUMMARY })
      .mockResolvedValueOnce({ data: EMPTY_SUMMARY })

    setup()
    await waitFor(() => screen.getByTestId('stop-btn'))
    fireEvent.click(screen.getByTestId('stop-btn'))
    await waitFor(() => expect(dashboardApi.getDashboardSummary).toHaveBeenCalledTimes(2))
  })
})
