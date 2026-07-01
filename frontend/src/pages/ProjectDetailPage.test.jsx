import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'
import ProjectDetailPage from './ProjectDetailPage'
import * as projectApi from '../api/projectApi'

vi.mock('../api/projectApi')

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

function makeSummary(overrides = {}) {
  return {
    id: 1,
    name: 'Thesis',
    description: 'Research project',
    parentId: null,
    totalSeconds: 3600,
    subprojects: [],
    tasks: [
      { id: 10, description: 'Read paper', startTime: '2026-06-01T10:00:00Z', endTime: '2026-06-01T11:00:00Z', running: false }
    ],
    ...overrides
  }
}

function setup(projectId = '1') {
  projectApi.getProjectSummary.mockResolvedValue({ data: makeSummary() })
  render(
    <MemoryRouter initialEntries={[`/projects/${projectId}`]}>
      <AuthProvider>
        <Routes>
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('ProjectDetailPage', () => {

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Initial render ────────────────────────────────────────

  it('shows loading state while fetching', () => {
    projectApi.getProjectSummary.mockReturnValue(new Promise(() => {}))
    setup()
    expect(screen.getByTestId('summary-loading')).toBeInTheDocument()
  })

  it('renders project name and description after load', async () => {
    setup()
    await waitFor(() => expect(screen.getByTestId('project-summary-name')).toBeInTheDocument())
    expect(screen.getByTestId('project-summary-name')).toHaveTextContent('Thesis')
    expect(screen.getByTestId('project-summary-desc')).toHaveTextContent('Research project')
  })

  it('renders total seconds as formatted time', async () => {
    setup()
    await waitFor(() => expect(screen.getByTestId('project-summary-total')).toBeInTheDocument())
    expect(screen.getByTestId('project-summary-total')).toHaveTextContent('1h 00m')
  })

  it('renders a task in the tasks section', async () => {
    setup()
    await waitFor(() => expect(screen.getByTestId('summary-task-10')).toBeInTheDocument())
    expect(screen.getByTestId('summary-task-duration-10')).toHaveTextContent('1h 00m')
  })

  it('renders tasks-section', async () => {
    setup()
    await waitFor(() => expect(screen.getByTestId('tasks-section')).toBeInTheDocument())
  })

  it('shows empty-tasks message when no tasks', async () => {
    projectApi.getProjectSummary.mockResolvedValue({ data: makeSummary({ tasks: [] }) })
    render(
      <MemoryRouter initialEntries={['/projects/1']}>
        <AuthProvider>
          <Routes><Route path="/projects/:id" element={<ProjectDetailPage />} /></Routes>
        </AuthProvider>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByTestId('empty-tasks')).toBeInTheDocument())
    expect(screen.getByTestId('empty-tasks')).toHaveTextContent('No tasks in this period')
  })

  it('shows running task as "(running)"', async () => {
    const runningTask = { id: 99, description: 'Active', startTime: '2026-06-15T08:00:00Z', endTime: null, running: true }
    projectApi.getProjectSummary.mockResolvedValue({ data: makeSummary({ tasks: [runningTask] }) })
    render(
      <MemoryRouter initialEntries={['/projects/1']}>
        <AuthProvider>
          <Routes><Route path="/projects/:id" element={<ProjectDetailPage />} /></Routes>
        </AuthProvider>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByTestId('summary-task-99')).toBeInTheDocument())
    expect(screen.getByTestId('summary-task-duration-99')).toHaveTextContent('(running)')
  })

  // ── Subprojects section ───────────────────────────────────

  it('renders subprojects section when subprojects present', async () => {
    const subprojects = [
      { id: 5, name: 'Literature Review', totalSeconds: 1800 },
      { id: 6, name: 'Experiments', totalSeconds: 900 }
    ]
    projectApi.getProjectSummary.mockResolvedValue({ data: makeSummary({ subprojects }) })
    render(
      <MemoryRouter initialEntries={['/projects/1']}>
        <AuthProvider>
          <Routes><Route path="/projects/:id" element={<ProjectDetailPage />} /></Routes>
        </AuthProvider>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByTestId('subprojects-section')).toBeInTheDocument())
    expect(screen.getByTestId('subproject-row-5')).toBeInTheDocument()
    expect(screen.getByTestId('subproject-total-5')).toHaveTextContent('30m')
    expect(screen.getByTestId('subproject-row-6')).toBeInTheDocument()
    expect(screen.getByTestId('subproject-total-6')).toHaveTextContent('15m')
  })

  it('does not render subprojects section when subprojects list is empty', async () => {
    setup()
    await waitFor(() => expect(screen.getByTestId('tasks-section')).toBeInTheDocument())
    expect(screen.queryByTestId('subprojects-section')).not.toBeInTheDocument()
  })

  it('shows zero total when no tasks in period', async () => {
    projectApi.getProjectSummary.mockResolvedValue({ data: makeSummary({ totalSeconds: 0, tasks: [] }) })
    render(
      <MemoryRouter initialEntries={['/projects/1']}>
        <AuthProvider>
          <Routes><Route path="/projects/:id" element={<ProjectDetailPage />} /></Routes>
        </AuthProvider>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByTestId('project-summary-total')).toBeInTheDocument())
    expect(screen.getByTestId('project-summary-total')).toHaveTextContent('0m')
  })

  // ── Back navigation ───────────────────────────────────────

  it('navigates back to /projects on back button click', async () => {
    setup()
    await waitFor(() => expect(screen.getByTestId('back-btn')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('back-btn'))
    expect(mockNavigate).toHaveBeenCalledWith('/projects')
  })

  // ── Preset buttons ────────────────────────────────────────

  it('renders all preset buttons', async () => {
    setup()
    expect(screen.getByTestId('preset-btn-all-time')).toBeInTheDocument()
    expect(screen.getByTestId('preset-btn-today')).toBeInTheDocument()
    expect(screen.getByTestId('preset-btn-this-week')).toBeInTheDocument()
    expect(screen.getByTestId('preset-btn-this-month')).toBeInTheDocument()
    expect(screen.getByTestId('preset-btn-custom')).toBeInTheDocument()
  })

  it('calls API with no date params for All Time preset', async () => {
    setup()
    await waitFor(() => expect(projectApi.getProjectSummary).toHaveBeenCalledWith('1', null, null))
  })

  it('calls API with today date range when Today preset selected', async () => {
    setup()
    await waitFor(() => expect(screen.getByTestId('preset-btn-today')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('preset-btn-today'))
    await waitFor(() => {
      const calls = projectApi.getProjectSummary.mock.calls
      const lastCall = calls[calls.length - 1]
      expect(lastCall[1]).not.toBeNull()
      expect(lastCall[2]).not.toBeNull()
    })
  })

  it('calls API with this-week date range when This Week preset selected', async () => {
    setup()
    await waitFor(() => expect(screen.getByTestId('preset-btn-this-week')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('preset-btn-this-week'))
    await waitFor(() => {
      const calls = projectApi.getProjectSummary.mock.calls
      const lastCall = calls[calls.length - 1]
      expect(lastCall[1]).not.toBeNull()
      expect(lastCall[2]).not.toBeNull()
    })
  })

  it('calls API with this-month date range when This Month preset selected', async () => {
    setup()
    await waitFor(() => expect(screen.getByTestId('preset-btn-this-month')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('preset-btn-this-month'))
    await waitFor(() => {
      const calls = projectApi.getProjectSummary.mock.calls
      const lastCall = calls[calls.length - 1]
      expect(lastCall[1]).not.toBeNull()
      expect(lastCall[2]).not.toBeNull()
    })
  })

  it('refetches when switching between presets', async () => {
    setup()
    await waitFor(() => expect(screen.getByTestId('preset-btn-today')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('preset-btn-today'))
    fireEvent.click(screen.getByTestId('preset-btn-this-week'))
    await waitFor(() => expect(projectApi.getProjectSummary.mock.calls.length).toBeGreaterThanOrEqual(3))
  })

  // ── Custom range ──────────────────────────────────────────

  it('shows custom range form when Custom preset selected', async () => {
    setup()
    await waitFor(() => expect(screen.getByTestId('preset-btn-custom')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('preset-btn-custom'))
    expect(screen.getByTestId('custom-from')).toBeInTheDocument()
    expect(screen.getByTestId('custom-to')).toBeInTheDocument()
  })

  it('does not auto-fetch when Custom preset selected (needs apply)', async () => {
    setup()
    const initialCallCount = projectApi.getProjectSummary.mock.calls.length
    await waitFor(() => expect(screen.getByTestId('preset-btn-custom')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('preset-btn-custom'))
    // No new call should happen just from clicking Custom
    expect(projectApi.getProjectSummary.mock.calls.length).toBe(initialCallCount)
  })

  it('calls API with custom dates when Apply is clicked', async () => {
    setup()
    await waitFor(() => expect(screen.getByTestId('preset-btn-custom')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('preset-btn-custom'))
    fireEvent.change(screen.getByTestId('custom-from'), { target: { value: '2026-06-01' } })
    fireEvent.change(screen.getByTestId('custom-to'),   { target: { value: '2026-06-30' } })
    fireEvent.click(screen.getByTestId('custom-apply-btn'))
    await waitFor(() => {
      const calls = projectApi.getProjectSummary.mock.calls
      const lastCall = calls[calls.length - 1]
      expect(lastCall[1]).toContain('2026-06-01')
      expect(lastCall[2]).toContain('2026-06-30')
    })
  })

  // ── Error handling ────────────────────────────────────────

  it('shows error message on 404', async () => {
    projectApi.getProjectSummary.mockRejectedValue({ response: { status: 404 } })
    render(
      <MemoryRouter initialEntries={['/projects/999']}>
        <AuthProvider>
          <Routes><Route path="/projects/:id" element={<ProjectDetailPage />} /></Routes>
        </AuthProvider>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByTestId('summary-error')).toBeInTheDocument())
    expect(screen.getByTestId('summary-error')).toHaveTextContent('Project not found')
  })

  it('shows generic error on non-404 failure', async () => {
    projectApi.getProjectSummary.mockRejectedValue({ response: { status: 500 } })
    render(
      <MemoryRouter initialEntries={['/projects/1']}>
        <AuthProvider>
          <Routes><Route path="/projects/:id" element={<ProjectDetailPage />} /></Routes>
        </AuthProvider>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByTestId('summary-error')).toBeInTheDocument())
    expect(screen.getByTestId('summary-error')).toHaveTextContent('Failed to load')
  })

  it('hides loading indicator after data loads', async () => {
    setup()
    await waitFor(() => expect(screen.queryByTestId('summary-loading')).not.toBeInTheDocument())
  })

  // ── Format helpers ────────────────────────────────────────

  it('formats hours and minutes correctly', async () => {
    projectApi.getProjectSummary.mockResolvedValue({ data: makeSummary({ totalSeconds: 7325 }) })
    render(
      <MemoryRouter initialEntries={['/projects/1']}>
        <AuthProvider>
          <Routes><Route path="/projects/:id" element={<ProjectDetailPage />} /></Routes>
        </AuthProvider>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByTestId('project-summary-total')).toBeInTheDocument())
    expect(screen.getByTestId('project-summary-total')).toHaveTextContent('2h 02m')
  })

  it('formats seconds-only duration correctly', async () => {
    const task = { id: 77, description: 'Quick', startTime: '2026-06-01T09:00:00Z', endTime: '2026-06-01T09:00:45Z', running: false }
    projectApi.getProjectSummary.mockResolvedValue({ data: makeSummary({ tasks: [task] }) })
    render(
      <MemoryRouter initialEntries={['/projects/1']}>
        <AuthProvider>
          <Routes><Route path="/projects/:id" element={<ProjectDetailPage />} /></Routes>
        </AuthProvider>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByTestId('summary-task-duration-77')).toBeInTheDocument())
    expect(screen.getByTestId('summary-task-duration-77')).toHaveTextContent('45s')
  })

})
