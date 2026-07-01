import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'
import { TimerProvider } from '../context/TimerContext'
import Layout from './Layout'
import * as taskApi from '../api/taskApi'

vi.mock('../api/taskApi')

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

function makeActiveTask(overrides = {}) {
  return {
    id: 1,
    description: 'Study session',
    startTime: new Date(Date.now() - 5000).toISOString(),
    endTime: null,
    running: true,
    ...overrides
  }
}

function setup() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <AuthProvider>
        <TimerProvider>
          <Layout />
        </TimerProvider>
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('Layout — topbar timer (US-018)', () => {

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── No running task ───────────────────────────────────────

  it('does not render topbar timer when no active task', async () => {
    taskApi.getActiveTask.mockResolvedValue({ status: 204, data: null })
    setup()
    await waitFor(() => expect(taskApi.getActiveTask).toHaveBeenCalled())
    expect(screen.queryByTestId('topbar-timer')).not.toBeInTheDocument()
  })

  it('does not show elapsed display when no active task', async () => {
    taskApi.getActiveTask.mockResolvedValue({ status: 204, data: null })
    setup()
    await waitFor(() => expect(taskApi.getActiveTask).toHaveBeenCalled())
    expect(screen.queryByTestId('topbar-elapsed')).not.toBeInTheDocument()
  })

  // ── Running task ──────────────────────────────────────────

  it('renders topbar timer banner when a task is running', async () => {
    taskApi.getActiveTask.mockResolvedValue({ status: 200, data: makeActiveTask() })
    setup()
    await waitFor(() => expect(screen.getByTestId('topbar-timer')).toBeInTheDocument())
  })

  it('shows task description in topbar timer', async () => {
    taskApi.getActiveTask.mockResolvedValue({ status: 200, data: makeActiveTask({ description: 'Study session' }) })
    setup()
    await waitFor(() => expect(screen.getByTestId('topbar-timer-desc')).toHaveTextContent('Study session'))
  })

  it('shows elapsed HH:MM:SS in topbar timer', async () => {
    taskApi.getActiveTask.mockResolvedValue({ status: 200, data: makeActiveTask() })
    setup()
    await waitFor(() => {
      const el = screen.getByTestId('topbar-elapsed')
      expect(el).toBeInTheDocument()
      expect(el.textContent).toMatch(/^\d{2}:\d{2}:\d{2}$/)
    })
  })

  it('shows fallback description "Timer running" when task has no description', async () => {
    taskApi.getActiveTask.mockResolvedValue({ status: 200, data: makeActiveTask({ description: null }) })
    setup()
    await waitFor(() => expect(screen.getByTestId('topbar-timer-desc')).toHaveTextContent('Timer running'))
  })

  // ── Timer computed from startTime, not localStorage ────────

  it('elapsed is computed from startTime — ~5 seconds for a 5-second-old task', async () => {
    const startTime = new Date(Date.now() - 5000).toISOString()
    taskApi.getActiveTask.mockResolvedValue({ status: 200, data: makeActiveTask({ startTime }) })
    setup()
    await waitFor(() => {
      const el = screen.getByTestId('topbar-elapsed')
      const [h, m, s] = el.textContent.split(':').map(Number)
      const totalSecs = h * 3600 + m * 60 + s
      expect(totalSecs).toBeGreaterThanOrEqual(4)
      expect(totalSecs).toBeLessThan(15)
    })
  })

  it('elapsed reflects a long-running task correctly (1 hour old)', async () => {
    const startTime = new Date(Date.now() - 3600000).toISOString()
    taskApi.getActiveTask.mockResolvedValue({ status: 200, data: makeActiveTask({ startTime }) })
    setup()
    await waitFor(() => {
      const el = screen.getByTestId('topbar-elapsed')
      const [h] = el.textContent.split(':').map(Number)
      expect(h).toBe(1)
    })
  })

  // ── Timer visible on non-Dashboard pages ─────────────────

  it('topbar timer is visible on the Overview page (not just Dashboard)', async () => {
    taskApi.getActiveTask.mockResolvedValue({ status: 200, data: makeActiveTask() })
    render(
      <MemoryRouter initialEntries={['/overview']}>
        <AuthProvider>
          <TimerProvider>
            <Layout />
          </TimerProvider>
        </AuthProvider>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByTestId('topbar-timer')).toBeInTheDocument())
  })

  it('topbar timer is visible on the Projects page', async () => {
    taskApi.getActiveTask.mockResolvedValue({ status: 200, data: makeActiveTask() })
    render(
      <MemoryRouter initialEntries={['/projects']}>
        <AuthProvider>
          <TimerProvider>
            <Layout />
          </TimerProvider>
        </AuthProvider>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByTestId('topbar-timer')).toBeInTheDocument())
  })

  it('topbar timer is visible on the Tasks page', async () => {
    taskApi.getActiveTask.mockResolvedValue({ status: 200, data: makeActiveTask() })
    render(
      <MemoryRouter initialEntries={['/tasks']}>
        <AuthProvider>
          <TimerProvider>
            <Layout />
          </TimerProvider>
        </AuthProvider>
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByTestId('topbar-timer')).toBeInTheDocument())
  })

  // ── API called on mount ───────────────────────────────────

  it('calls getActiveTask on mount to rehydrate timer state', async () => {
    taskApi.getActiveTask.mockResolvedValue({ status: 204, data: null })
    setup()
    await waitFor(() => expect(taskApi.getActiveTask).toHaveBeenCalledTimes(1))
  })

  it('does not call getActiveTask multiple times on a single mount', async () => {
    taskApi.getActiveTask.mockResolvedValue({ status: 204, data: null })
    setup()
    await waitFor(() => expect(taskApi.getActiveTask).toHaveBeenCalled())
    expect(taskApi.getActiveTask).toHaveBeenCalledTimes(1)
  })

  // ── Nav links present ─────────────────────────────────────

  it('renders all main navigation links', () => {
    taskApi.getActiveTask.mockResolvedValue({ status: 204, data: null })
    setup()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Tasks')).toBeInTheDocument()
    expect(screen.getByText('Projects')).toBeInTheDocument()
    expect(screen.getByText('Overview')).toBeInTheDocument()
  })
})
