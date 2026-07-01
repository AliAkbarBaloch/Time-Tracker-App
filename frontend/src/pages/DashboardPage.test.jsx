import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import DashboardPage from './DashboardPage'
import { AuthProvider } from '../context/AuthContext'
import { TimerProvider } from '../context/TimerContext'
import * as taskApi from '../api/taskApi'
import * as dashboardApi from '../api/dashboardApi'
import * as templateApi from '../api/templateApi'
import * as projectApi from '../api/projectApi'

vi.mock('../api/taskApi')
vi.mock('../api/dashboardApi')
vi.mock('../api/templateApi')
vi.mock('../api/projectApi')

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
    templateApi.listTemplates.mockResolvedValue({ data: [] })
    projectApi.listProjects.mockResolvedValue({ data: [] })
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

// ── US-027: Task Templates ─────────────────────────────────────────────────────

describe('DashboardPage — Task Templates (US-027)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    localStorage.clear()
    dashboardApi.getDashboardSummary.mockResolvedValue({ data: EMPTY_SUMMARY })
    projectApi.listProjects.mockResolvedValue({ data: [] })
    taskApi.getActiveTask.mockResolvedValue({ status: 204, data: null })
  })

  it('shows templates section and empty state when no templates', async () => {
    templateApi.listTemplates.mockResolvedValue({ data: [] })
    setup()
    await waitFor(() => screen.getByTestId('templates-section'))
    expect(screen.getByTestId('templates-empty')).toBeInTheDocument()
  })

  it('renders template cards with name, description and project chips', async () => {
    templateApi.listTemplates.mockResolvedValue({
      data: [{
        id: 1, name: 'Daily Stand-Up', description: 'Morning sync',
        projects: [{ id: 5, name: 'Thesis' }], createdAt: new Date().toISOString()
      }]
    })
    setup()
    await waitFor(() => screen.getByTestId('template-card-1'))
    expect(screen.getByTestId('template-name-1')).toHaveTextContent('Daily Stand-Up')
    expect(screen.getByTestId('template-desc-1')).toHaveTextContent('Morning sync')
    expect(screen.getByTestId('template-projects-1')).toHaveTextContent('Thesis')
  })

  it('Start button calls startTemplate API and refreshes summary', async () => {
    templateApi.listTemplates.mockResolvedValue({
      data: [{ id: 2, name: 'Code Review', description: null, projects: [], createdAt: new Date().toISOString() }]
    })
    templateApi.startTemplate.mockResolvedValueOnce({
      data: { id: 10, description: null, startTime: new Date().toISOString(), endTime: null, running: true, projects: [] }
    })
    dashboardApi.getDashboardSummary.mockResolvedValue({ data: EMPTY_SUMMARY })

    setup()
    await waitFor(() => screen.getByTestId('template-start-btn-2'))
    fireEvent.click(screen.getByTestId('template-start-btn-2'))

    await waitFor(() => expect(templateApi.startTemplate).toHaveBeenCalledWith(2))
    await waitFor(() => expect(dashboardApi.getDashboardSummary).toHaveBeenCalledTimes(2))
  })

  it('New Template button toggles create form', async () => {
    templateApi.listTemplates.mockResolvedValue({ data: [] })
    setup()
    await waitFor(() => screen.getByTestId('new-template-btn'))

    expect(screen.queryByTestId('template-form')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('new-template-btn'))
    expect(screen.getByTestId('template-form')).toBeInTheDocument()
    expect(screen.getByTestId('template-name-input')).toBeInTheDocument()
    expect(screen.getByTestId('template-desc-input')).toBeInTheDocument()
  })

  it('submitting create form calls createTemplate and refreshes list', async () => {
    templateApi.listTemplates.mockResolvedValue({ data: [] })
    templateApi.createTemplate.mockResolvedValueOnce({
      data: { id: 3, name: 'New Tpl', description: null, projects: [], createdAt: new Date().toISOString() }
    })

    setup()
    await waitFor(() => screen.getByTestId('new-template-btn'))
    fireEvent.click(screen.getByTestId('new-template-btn'))
    fireEvent.change(screen.getByTestId('template-name-input'), { target: { value: 'New Tpl' } })
    fireEvent.submit(screen.getByTestId('template-form'))

    await waitFor(() =>
      expect(templateApi.createTemplate).toHaveBeenCalledWith('New Tpl', null, [])
    )
    await waitFor(() => expect(templateApi.listTemplates).toHaveBeenCalledTimes(2))
  })

  it('Edit button opens inline edit form pre-filled with template data', async () => {
    templateApi.listTemplates.mockResolvedValue({
      data: [{ id: 4, name: 'Old Name', description: 'Old desc', projects: [], createdAt: new Date().toISOString() }]
    })
    setup()
    await waitFor(() => screen.getByTestId('template-edit-btn-4'))
    fireEvent.click(screen.getByTestId('template-edit-btn-4'))
    expect(screen.getByTestId('template-edit-form-4')).toBeInTheDocument()
    expect(screen.getByTestId('template-edit-name-4').value).toBe('Old Name')
    expect(screen.getByTestId('template-edit-desc-4').value).toBe('Old desc')
  })

  it('saving edit form calls updateTemplate and refreshes list', async () => {
    templateApi.listTemplates.mockResolvedValue({
      data: [{ id: 5, name: 'Old', description: null, projects: [], createdAt: new Date().toISOString() }]
    })
    templateApi.updateTemplate.mockResolvedValueOnce({
      data: { id: 5, name: 'New', description: null, projects: [], createdAt: new Date().toISOString() }
    })

    setup()
    await waitFor(() => screen.getByTestId('template-edit-btn-5'))
    fireEvent.click(screen.getByTestId('template-edit-btn-5'))
    fireEvent.change(screen.getByTestId('template-edit-name-5'), { target: { value: 'New' } })
    fireEvent.submit(screen.getByTestId('template-edit-form-5'))

    await waitFor(() =>
      expect(templateApi.updateTemplate).toHaveBeenCalledWith(5, 'New', null, [])
    )
  })

  it('Delete button shows confirm dialog, confirming calls deleteTemplate', async () => {
    templateApi.listTemplates.mockResolvedValue({
      data: [{ id: 6, name: 'ToDelete', description: null, projects: [], createdAt: new Date().toISOString() }]
    })
    templateApi.deleteTemplate.mockResolvedValueOnce({})

    setup()
    await waitFor(() => screen.getByTestId('template-delete-btn-6'))
    fireEvent.click(screen.getByTestId('template-delete-btn-6'))

    expect(screen.getByTestId('template-delete-dialog-6')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('template-delete-confirm-btn-6'))

    await waitFor(() => expect(templateApi.deleteTemplate).toHaveBeenCalledWith(6))
  })

  it('shows project checkboxes in create form when projects exist', async () => {
    templateApi.listTemplates.mockResolvedValue({ data: [] })
    projectApi.listProjects.mockResolvedValue({
      data: [{ id: 7, name: 'MyProject', subprojects: [], totalSeconds: 0, createdAt: new Date().toISOString() }]
    })

    setup()
    await waitFor(() => screen.getByTestId('new-template-btn'))
    fireEvent.click(screen.getByTestId('new-template-btn'))

    await waitFor(() => screen.getByTestId('template-project-selector'))
    expect(screen.getByTestId('template-project-checkbox-7')).toBeInTheDocument()
  })
})
