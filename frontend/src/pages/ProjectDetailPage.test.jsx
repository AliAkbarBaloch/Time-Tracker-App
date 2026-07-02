import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'
import ProjectDetailPage from './ProjectDetailPage'
import * as projectApi from '../api/projectApi'

vi.mock('../api/projectApi')

// Mock browser APIs used by the Blob download flow (US-024)
global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = vi.fn()

// Default members returned by getMembers (Alice is OWNER, Bob is MEMBER)
const ALICE_ID = 1
const BOB_ID   = 2
const DEFAULT_MEMBERS = [
  { userId: ALICE_ID, email: 'alice@example.com', displayName: 'Alice', role: 'OWNER',  joinedAt: '2026-06-01T00:00:00Z' },
  { userId: BOB_ID,   email: 'bob@example.com',   displayName: 'Bob',   role: 'MEMBER', joinedAt: '2026-06-02T00:00:00Z' },
]

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
  // Default: getMembers returns Alice (OWNER) + Bob (MEMBER); current user is Alice
  projectApi.getMembers.mockResolvedValue({ data: DEFAULT_MEMBERS })
  localStorage.setItem('tt_user', JSON.stringify({ email: 'alice@example.com', displayName: 'Alice' }))
  localStorage.setItem('tt_token', 'fake-token')
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
    localStorage.clear()
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
    // US-023: getProjectSummary now accepts a 4th userId param (null = all users)
    await waitFor(() => expect(projectApi.getProjectSummary).toHaveBeenCalledWith('1', null, null, null))
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

  // ── US-022: Members section ───────────────────────────────────────────────

  it('renders the members section', async () => {
    setup()
    await waitFor(() => expect(screen.getByTestId('members-section')).toBeInTheDocument())
  })

  it('renders member list with name, email and role', async () => {
    setup()
    await waitFor(() => expect(screen.getByTestId(`member-row-${BOB_ID}`)).toBeInTheDocument())
    expect(screen.getByTestId(`member-name-${BOB_ID}`)).toHaveTextContent('Bob')
    expect(screen.getByTestId(`member-email-${BOB_ID}`)).toHaveTextContent('bob@example.com')
    expect(screen.getByTestId(`member-role-${BOB_ID}`)).toHaveTextContent('MEMBER')
  })

  it('shows invite form for project owner', async () => {
    setup()
    await waitFor(() => expect(screen.getByTestId('invite-form')).toBeInTheDocument())
    expect(screen.getByTestId('invite-email-input')).toBeInTheDocument()
    expect(screen.getByTestId('invite-submit-btn')).toBeInTheDocument()
  })

  it('does not show invite form for non-owner member', async () => {
    projectApi.getProjectSummary.mockResolvedValue({ data: makeSummary() })
    // Bob is a MEMBER, not OWNER
    projectApi.getMembers.mockResolvedValue({ data: DEFAULT_MEMBERS })
    localStorage.setItem('tt_user', JSON.stringify({ email: 'bob@example.com', displayName: 'Bob' }))
    localStorage.setItem('tt_token', 'fake-token')
    render(
      <MemoryRouter initialEntries={['/projects/1']}>
        <AuthProvider>
          <Routes><Route path="/projects/:id" element={<ProjectDetailPage />} /></Routes>
        </AuthProvider>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByTestId('members-section')).toBeInTheDocument())
    expect(screen.queryByTestId('invite-form')).not.toBeInTheDocument()
  })

  it('calls inviteMember API with correct email on submit', async () => {
    projectApi.inviteMember.mockResolvedValue({ data: { userId: 3, email: 'carol@example.com', displayName: 'Carol', role: 'MEMBER', joinedAt: '2026-06-03T00:00:00Z' } })
    projectApi.getMembers.mockResolvedValue({ data: DEFAULT_MEMBERS })
    setup()

    await waitFor(() => expect(screen.getByTestId('invite-form')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('invite-email-input'), { target: { value: 'carol@example.com' } })
    fireEvent.click(screen.getByTestId('invite-submit-btn'))

    await waitFor(() => expect(projectApi.inviteMember).toHaveBeenCalledWith('1', 'carol@example.com'))
  })

  it('shows error message when invite fails', async () => {
    projectApi.inviteMember.mockRejectedValue({ response: { data: { message: 'No registered user found with email: unknown@x.com' } } })
    setup()

    await waitFor(() => expect(screen.getByTestId('invite-form')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('invite-email-input'), { target: { value: 'unknown@x.com' } })
    fireEvent.click(screen.getByTestId('invite-submit-btn'))

    await waitFor(() => expect(screen.getByTestId('invite-error')).toBeInTheDocument())
    expect(screen.getByTestId('invite-error')).toHaveTextContent('No registered user found')
  })

  it('clears invite error when user types in the email input', async () => {
    projectApi.inviteMember.mockRejectedValueOnce({
      response: { data: { message: 'No registered user found' } }
    })
    setup()
    await waitFor(() => expect(screen.getByTestId('invite-form')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('invite-email-input'), { target: { value: 'bad@x.com' } })
    fireEvent.click(screen.getByTestId('invite-submit-btn'))
    await waitFor(() => expect(screen.getByTestId('invite-error')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('invite-email-input'), { target: { value: 'good@x.com' } })
    expect(screen.queryByTestId('invite-error')).not.toBeInTheDocument()
  })

  it('renders Add Task button linking to /tasks with project pre-selected', async () => {
    setup()
    await waitFor(() => expect(screen.getByTestId('add-task-to-project-btn')).toBeInTheDocument())
    const btn = screen.getByTestId('add-task-to-project-btn')
    expect(btn).toHaveAttribute('href', '/tasks?projectId=1&addTask=true')
  })

  it('shows remove button only for MEMBER rows when current user is OWNER', async () => {
    setup()
    await waitFor(() => expect(screen.getByTestId(`member-row-${BOB_ID}`)).toBeInTheDocument())
    // Bob (MEMBER) has a remove button
    expect(screen.getByTestId(`remove-member-btn-${BOB_ID}`)).toBeInTheDocument()
    // Alice (OWNER) does NOT have a remove button on her own row
    expect(screen.queryByTestId(`remove-member-btn-${ALICE_ID}`)).not.toBeInTheDocument()
  })

  it('calls removeMember API when remove button is clicked', async () => {
    projectApi.removeMember.mockResolvedValue({})
    setup()

    await waitFor(() => expect(screen.getByTestId(`remove-member-btn-${BOB_ID}`)).toBeInTheDocument())
    fireEvent.click(screen.getByTestId(`remove-member-btn-${BOB_ID}`))

    await waitFor(() => expect(projectApi.removeMember).toHaveBeenCalledWith('1', BOB_ID))
  })

  it('displays member count in section header', async () => {
    setup()
    await waitFor(() => expect(screen.getByTestId('members-count')).toHaveTextContent('2 members'))
  })

  // ── US-023: Contributors card and user-filter dropdown ────────────────────

  it('renders contributors section when summary has multiple contributions', async () => {
    // mockResolvedValueOnce before setup() so it wins over setup()'s default mock
    projectApi.getProjectSummary.mockResolvedValueOnce({
      data: makeSummary({
        contributions: [
          { userId: ALICE_ID, displayName: 'Alice', totalSeconds: 3600 },
          { userId: BOB_ID,   displayName: 'Bob',   totalSeconds: 1800 },
        ]
      })
    })
    setup()
    await waitFor(() => expect(screen.getByTestId('contributors-section')).toBeInTheDocument())
    expect(screen.getByTestId(`contributor-name-${ALICE_ID}`)).toHaveTextContent('Alice')
    expect(screen.getByTestId(`contributor-name-${BOB_ID}`)).toHaveTextContent('Bob')
    expect(screen.getByTestId(`contributor-total-${ALICE_ID}`)).toHaveTextContent('1h 00m')
    expect(screen.getByTestId(`contributor-total-${BOB_ID}`)).toHaveTextContent('30m')
  })

  it('does not render contributors section when summary has only one contribution', async () => {
    // Solo project → contributions has 1 entry → no card shown
    projectApi.getProjectSummary.mockResolvedValue({
      data: makeSummary({
        contributions: [{ userId: ALICE_ID, displayName: 'Alice', totalSeconds: 3600 }]
      })
    })
    setup()
    await waitFor(() => expect(screen.getByTestId('project-summary-name')).toBeInTheDocument())
    expect(screen.queryByTestId('contributors-section')).not.toBeInTheDocument()
  })

  it('renders user-filter dropdown for shared projects', async () => {
    projectApi.getProjectSummary.mockResolvedValueOnce({
      data: makeSummary({
        contributions: [
          { userId: ALICE_ID, displayName: 'Alice', totalSeconds: 3600 },
          { userId: BOB_ID,   displayName: 'Bob',   totalSeconds: 1800 },
        ]
      })
    })
    setup()
    await waitFor(() => expect(screen.getByTestId('user-filter-select')).toBeInTheDocument())
    // Dropdown must have "All users" option plus one per contributor
    const select = screen.getByTestId('user-filter-select')
    expect(select).toHaveDisplayValue('All users')
  })

  it('changing user-filter dropdown re-fetches summary with userId param', async () => {
    const twoContributions = [
      { userId: ALICE_ID, displayName: 'Alice', totalSeconds: 3600 },
      { userId: BOB_ID,   displayName: 'Bob',   totalSeconds: 1800 },
    ]
    projectApi.getProjectSummary
      .mockResolvedValueOnce({ data: makeSummary({ contributions: twoContributions }) })
      .mockResolvedValueOnce({ data: makeSummary({ totalSeconds: 1800, contributions: twoContributions,
        tasks: [{ id: 20, description: 'Bob task', startTime: '2026-06-01T10:00:00Z', endTime: '2026-06-01T10:30:00Z', running: false, userId: BOB_ID, userName: 'Bob' }] }) })

    setup()
    await waitFor(() => expect(screen.getByTestId('user-filter-select')).toBeInTheDocument())

    // Select Bob from dropdown
    fireEvent.change(screen.getByTestId('user-filter-select'), { target: { value: String(BOB_ID) } })

    // Summary API should be called again with userId = BOB_ID
    await waitFor(() =>
      expect(projectApi.getProjectSummary).toHaveBeenCalledWith('1', null, null, BOB_ID)
    )
  })

  it('shows task owner name on shared project task rows', async () => {
    projectApi.getProjectSummary.mockResolvedValueOnce({
      data: makeSummary({
        contributions: [
          { userId: ALICE_ID, displayName: 'Alice', totalSeconds: 3600 },
          { userId: BOB_ID,   displayName: 'Bob',   totalSeconds: 1800 },
        ],
        tasks: [
          { id: 10, description: 'Alice task', startTime: '2026-06-01T10:00:00Z',
            endTime: '2026-06-01T11:00:00Z', running: false, userId: ALICE_ID, userName: 'Alice' },
          { id: 11, description: 'Bob task',   startTime: '2026-06-01T11:00:00Z',
            endTime: '2026-06-01T11:30:00Z', running: false, userId: BOB_ID,   userName: 'Bob' },
        ]
      })
    })
    setup()
    await waitFor(() => expect(screen.getByTestId('task-owner-10')).toBeInTheDocument())
    expect(screen.getByTestId('task-owner-10')).toHaveTextContent('Alice')
    expect(screen.getByTestId('task-owner-11')).toHaveTextContent('Bob')
  })

  it('does not show task owner name for solo projects', async () => {
    // Only one contribution → not a shared project → no owner badge on tasks
    projectApi.getProjectSummary.mockResolvedValue({
      data: makeSummary({
        contributions: [{ userId: ALICE_ID, displayName: 'Alice', totalSeconds: 3600 }],
        tasks: [{ id: 10, description: 'Solo task', startTime: '2026-06-01T10:00:00Z',
          endTime: '2026-06-01T11:00:00Z', running: false, userId: ALICE_ID, userName: 'Alice' }]
      })
    })
    setup()
    await waitFor(() => expect(screen.getByTestId('summary-task-10')).toBeInTheDocument())
    expect(screen.queryByTestId('task-owner-10')).not.toBeInTheDocument()
  })

  // ── US-024: Export button and modal ──────────────────────────────────────

  it('renders export button on project detail page', async () => {
    setup()
    await waitFor(() => expect(screen.getByTestId('project-summary-name')).toBeInTheDocument())
    expect(screen.getByTestId('export-btn')).toBeInTheDocument()
  })

  it('opens export modal when export button is clicked', async () => {
    setup()
    await waitFor(() => expect(screen.getByTestId('export-btn')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('export-btn'))
    expect(screen.getByTestId('export-modal')).toBeInTheDocument()
  })

  it('export modal contains format and scope selectors', async () => {
    setup()
    await waitFor(() => expect(screen.getByTestId('export-btn')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('export-btn'))
    // Format radios
    expect(screen.getByTestId('export-format-csv')).toBeInTheDocument()
    expect(screen.getByTestId('export-format-json')).toBeInTheDocument()
    // Scope radios
    expect(screen.getByTestId('export-scope-all')).toBeInTheDocument()
    expect(screen.getByTestId('export-scope-month')).toBeInTheDocument()
  })

  it('shows year and month inputs only when Specific Month scope is selected', async () => {
    setup()
    await waitFor(() => expect(screen.getByTestId('export-btn')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('export-btn'))
    // Month inputs not shown by default (All Time is default scope)
    expect(screen.queryByTestId('export-year-input')).not.toBeInTheDocument()
    // Select Specific Month
    fireEvent.click(screen.getByTestId('export-scope-month'))
    expect(screen.getByTestId('export-year-input')).toBeInTheDocument()
    expect(screen.getByTestId('export-month-input')).toBeInTheDocument()
  })

  it('cancel button closes the export modal', async () => {
    setup()
    await waitFor(() => expect(screen.getByTestId('export-btn')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('export-btn'))
    expect(screen.getByTestId('export-modal')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('export-cancel-btn'))
    expect(screen.queryByTestId('export-modal')).not.toBeInTheDocument()
  })

  it('clicking Download calls exportProject and triggers blob download', async () => {
    // Resolve with a Blob response as the real API would
    projectApi.exportProject = vi.fn().mockResolvedValue({ data: new Blob(['csv'], { type: 'text/csv' }) })
    setup()

    await waitFor(() => expect(screen.getByTestId('export-btn')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('export-btn'))
    fireEvent.click(screen.getByTestId('export-submit-btn'))

    await waitFor(() => expect(projectApi.exportProject).toHaveBeenCalled())
    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalled()
    // Modal closes after successful download
    await waitFor(() => expect(screen.queryByTestId('export-modal')).not.toBeInTheDocument())
  })

  it('export with JSON format passes format=json to the API', async () => {
    projectApi.exportProject = vi.fn().mockResolvedValue({ data: new Blob(['{}'], { type: 'application/json' }) })
    setup()

    await waitFor(() => expect(screen.getByTestId('export-btn')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('export-btn'))
    // Switch to JSON format
    fireEvent.click(screen.getByTestId('export-format-json'))
    fireEvent.click(screen.getByTestId('export-submit-btn'))

    await waitFor(() => expect(projectApi.exportProject).toHaveBeenCalledWith(
      '1', 'json', null, null, null, null
    ))
  })

  it('export with Specific Month scope passes year and month to the API', async () => {
    projectApi.exportProject = vi.fn().mockResolvedValue({ data: new Blob(['csv'], { type: 'text/csv' }) })
    setup()

    await waitFor(() => expect(screen.getByTestId('export-btn')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('export-btn'))
    fireEvent.click(screen.getByTestId('export-scope-month'))

    // Change year and month inputs
    fireEvent.change(screen.getByTestId('export-year-input'),  { target: { value: '2026' } })
    fireEvent.change(screen.getByTestId('export-month-input'), { target: { value: '6' } })
    fireEvent.click(screen.getByTestId('export-submit-btn'))

    await waitFor(() => expect(projectApi.exportProject).toHaveBeenCalledWith(
      '1', 'csv', null, null, 2026, 6
    ))
  })

  it('shows error message when export API call fails', async () => {
    projectApi.exportProject = vi.fn().mockRejectedValue(new Error('Network error'))
    setup()

    await waitFor(() => expect(screen.getByTestId('export-btn')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('export-btn'))
    fireEvent.click(screen.getByTestId('export-submit-btn'))

    await waitFor(() => expect(screen.getByTestId('export-error')).toBeInTheDocument())
    expect(screen.getByTestId('export-error')).toHaveTextContent('Export failed')
    // Modal stays open on error
    expect(screen.getByTestId('export-modal')).toBeInTheDocument()
  })

})
