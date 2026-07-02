import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'
import { TimerProvider } from '../context/TimerContext'
import { ThemeProvider } from '../context/ThemeContext'
import Layout from './Layout'
import * as taskApi from '../api/taskApi'

vi.mock('../api/taskApi')

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// matchMedia is not implemented in jsdom — provide a safe stub
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
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
    <ThemeProvider>
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <TimerProvider>
            <Layout />
          </TimerProvider>
        </AuthProvider>
      </MemoryRouter>
    </ThemeProvider>
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
      <ThemeProvider>
        <MemoryRouter initialEntries={['/overview']}>
          <AuthProvider>
            <TimerProvider>
              <Layout />
            </TimerProvider>
          </AuthProvider>
        </MemoryRouter>
      </ThemeProvider>
    )
    await waitFor(() => expect(screen.getByTestId('topbar-timer')).toBeInTheDocument())
  })

  it('topbar timer is visible on the Projects page', async () => {
    taskApi.getActiveTask.mockResolvedValue({ status: 200, data: makeActiveTask() })
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/projects']}>
          <AuthProvider>
            <TimerProvider>
              <Layout />
            </TimerProvider>
          </AuthProvider>
        </MemoryRouter>
      </ThemeProvider>
    )
    await waitFor(() => expect(screen.getByTestId('topbar-timer')).toBeInTheDocument())
  })

  it('topbar timer is visible on the Tasks page', async () => {
    taskApi.getActiveTask.mockResolvedValue({ status: 200, data: makeActiveTask() })
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/tasks']}>
          <AuthProvider>
            <TimerProvider>
              <Layout />
            </TimerProvider>
          </AuthProvider>
        </MemoryRouter>
      </ThemeProvider>
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

// ─────────────────────────────────────────────────────────────────────────────
// Theme toggle
// ─────────────────────────────────────────────────────────────────────────────
describe('Layout — theme toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('renders Light, Dark and Auto theme buttons', () => {
    taskApi.getActiveTask.mockResolvedValue({ status: 204, data: null })
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <AuthProvider>
            <TimerProvider>
              <Layout />
            </TimerProvider>
          </AuthProvider>
        </MemoryRouter>
      </ThemeProvider>
    )
    expect(screen.getByTitle('Light mode')).toBeInTheDocument()
    expect(screen.getByTitle('Dark mode')).toBeInTheDocument()
    expect(screen.getByTitle('Follow system preference')).toBeInTheDocument()
  })

  it('clicking Dark sets data-theme="dark" on <html>', () => {
    taskApi.getActiveTask.mockResolvedValue({ status: 204, data: null })
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <AuthProvider>
            <TimerProvider>
              <Layout />
            </TimerProvider>
          </AuthProvider>
        </MemoryRouter>
      </ThemeProvider>
    )
    fireEvent.click(screen.getByTitle('Dark mode'))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('clicking Light sets data-theme="light" on <html>', () => {
    taskApi.getActiveTask.mockResolvedValue({ status: 204, data: null })
    localStorage.setItem('tt_theme', 'dark')
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <AuthProvider>
            <TimerProvider>
              <Layout />
            </TimerProvider>
          </AuthProvider>
        </MemoryRouter>
      </ThemeProvider>
    )
    fireEvent.click(screen.getByTitle('Light mode'))
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('clicking Auto (system) sets data-theme based on OS preference', () => {
    taskApi.getActiveTask.mockResolvedValue({ status: 204, data: null })
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <AuthProvider>
            <TimerProvider>
              <Layout />
            </TimerProvider>
          </AuthProvider>
        </MemoryRouter>
      </ThemeProvider>
    )
    fireEvent.click(screen.getByTitle('Follow system preference'))
    // matchMedia stub returns matches:false → light
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Mobile hamburger & overlay
// ─────────────────────────────────────────────────────────────────────────────
describe('Layout — mobile hamburger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  function setupMobile() {
    return render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <AuthProvider>
            <TimerProvider>
              <Layout />
            </TimerProvider>
          </AuthProvider>
        </MemoryRouter>
      </ThemeProvider>
    )
  }

  it('sidebar starts without "open" class', () => {
    taskApi.getActiveTask.mockResolvedValue({ status: 204, data: null })
    setupMobile()
    expect(document.querySelector('.sidebar')).not.toHaveClass('open')
  })

  it('clicking hamburger adds "open" class to sidebar', () => {
    taskApi.getActiveTask.mockResolvedValue({ status: 204, data: null })
    setupMobile()
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }))
    expect(document.querySelector('.sidebar')).toHaveClass('open')
  })

  it('clicking hamburger again removes "open" class (toggle)', () => {
    taskApi.getActiveTask.mockResolvedValue({ status: 204, data: null })
    setupMobile()
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }))
    fireEvent.click(screen.getByRole('button', { name: /close menu/i }))
    expect(document.querySelector('.sidebar')).not.toHaveClass('open')
  })

  it('clicking the sidebar overlay closes the sidebar', () => {
    taskApi.getActiveTask.mockResolvedValue({ status: 204, data: null })
    setupMobile()
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }))
    expect(document.querySelector('.sidebar')).toHaveClass('open')
    fireEvent.click(document.querySelector('.sidebar-overlay'))
    expect(document.querySelector('.sidebar')).not.toHaveClass('open')
  })
})
