import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import OverviewPage from './OverviewPage'
import { AuthProvider } from '../context/AuthContext'
import * as taskApi from '../api/taskApi'

vi.mock('../api/taskApi')

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// ─── Shared helpers ─────────────────────────────────────────────────────────

function getThisMonday() {
  const now = new Date()
  const dow = now.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff)
}

function makeMondayTask(overrides = {}) {
  const monday = getThisMonday()
  return {
    id: 1,
    description: 'Monday work',
    startTime: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 10, 0, 0).toISOString(),
    endTime:   new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 11, 0, 0).toISOString(),
    running: false,
    projects: [],
    ...overrides,
  }
}

function getCurrentMonthDay1Str() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

function makeMonthDay1Task(overrides = {}) {
  const now = new Date()
  return {
    id: 200,
    description: 'Month task',
    startTime: new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0).toISOString(),
    endTime:   new Date(now.getFullYear(), now.getMonth(), 1, 13, 0, 0).toISOString(),
    running: false,
    projects: [],
    ...overrides,
  }
}

function setup() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <OverviewPage />
      </AuthProvider>
    </MemoryRouter>
  )
}

// ─── Week view tests ─────────────────────────────────────────────────────────

describe('OverviewPage — week view', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    taskApi.listTasks.mockResolvedValue({ data: [] })
  })

  it('renders 7 day columns', async () => {
    setup()
    await waitFor(() => expect(screen.getByTestId('week-view')).toBeInTheDocument())
    for (let i = 0; i < 7; i++) {
      expect(screen.getByTestId(`week-col-${i}`)).toBeInTheDocument()
    }
  })

  it('shows week and month toggle tabs', async () => {
    setup()
    await waitFor(() => expect(screen.getByTestId('view-tab-week')).toBeInTheDocument())
    expect(screen.getByTestId('view-tab-month')).toBeInTheDocument()
  })

  it('shows dash for all day totals when no tasks', async () => {
    setup()
    await waitFor(() => expect(screen.getByTestId('day-total-0')).toBeInTheDocument())
    for (let i = 0; i < 7; i++) {
      expect(screen.getByTestId(`day-total-${i}`).textContent).toBe('—')
    }
  })

  it('shows dash for week total when no tasks', async () => {
    setup()
    await waitFor(() =>
      expect(screen.getByTestId('week-total').textContent).toBe('—')
    )
  })

  it('shows prev and next week navigation buttons', async () => {
    setup()
    await waitFor(() => expect(screen.getByTestId('prev-week-btn')).toBeInTheDocument())
    expect(screen.getByTestId('next-week-btn')).toBeInTheDocument()
    expect(screen.getByTestId('week-label')).toBeInTheDocument()
  })

  it('week label changes when clicking prev-week', async () => {
    setup()
    await waitFor(() => expect(screen.getByTestId('week-label')).toBeInTheDocument())
    const currentLabel = screen.getByTestId('week-label').textContent
    fireEvent.click(screen.getByTestId('prev-week-btn'))
    await waitFor(() =>
      expect(screen.getByTestId('week-label').textContent).not.toBe(currentLabel)
    )
  })

  it('week label changes when clicking next-week', async () => {
    setup()
    await waitFor(() => expect(screen.getByTestId('week-label')).toBeInTheDocument())
    const currentLabel = screen.getByTestId('week-label').textContent
    fireEvent.click(screen.getByTestId('next-week-btn'))
    await waitFor(() =>
      expect(screen.getByTestId('week-label').textContent).not.toBe(currentLabel)
    )
  })

  it('fetches tasks again when navigating weeks', async () => {
    setup()
    await waitFor(() => expect(taskApi.listTasks).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByTestId('prev-week-btn'))
    await waitFor(() => expect(taskApi.listTasks).toHaveBeenCalledTimes(2))
  })

  it('shows task in Monday column (col-0) when task falls on Monday', async () => {
    const task = makeMondayTask()
    taskApi.listTasks.mockResolvedValue({ data: [task] })
    setup()
    await waitFor(() =>
      expect(screen.getByTestId(`week-task-${task.id}`)).toBeInTheDocument()
    )
    const mondayCol = screen.getByTestId('week-col-0')
    expect(mondayCol).toContainElement(screen.getByTestId(`week-task-${task.id}`))
  })

  it('shows task description in the task row', async () => {
    const task = makeMondayTask({ description: 'Write tests' })
    taskApi.listTasks.mockResolvedValue({ data: [task] })
    setup()
    await waitFor(() => expect(screen.getByText('Write tests')).toBeInTheDocument())
  })

  it('shows task duration in the task row', async () => {
    const task = makeMondayTask()
    taskApi.listTasks.mockResolvedValue({ data: [task] })
    setup()
    await waitFor(() =>
      expect(screen.getByTestId(`week-task-${task.id}`)).toBeInTheDocument()
    )
    expect(screen.getByTestId(`week-task-${task.id}`).textContent).toContain('m')
  })

  it('shows correct per-day total for Monday (1 hour task)', async () => {
    const task = makeMondayTask()
    taskApi.listTasks.mockResolvedValue({ data: [task] })
    setup()
    await waitFor(() =>
      expect(screen.getByTestId('day-total-0').textContent).toBe('1h 00m')
    )
  })

  it('shows correct week total for a single 1-hour task', async () => {
    const task = makeMondayTask()
    taskApi.listTasks.mockResolvedValue({ data: [task] })
    setup()
    await waitFor(() =>
      expect(screen.getByTestId('week-total').textContent).toBe('1h 00m')
    )
  })

  it('shows (running) for a task with no endTime', async () => {
    const task = makeMondayTask({ endTime: null, running: true })
    taskApi.listTasks.mockResolvedValue({ data: [task] })
    setup()
    await waitFor(() =>
      expect(screen.getByTestId(`week-task-${task.id}`).textContent).toContain('running')
    )
  })

  it('shows (no description) for task with no description', async () => {
    const task = makeMondayTask({ description: null })
    taskApi.listTasks.mockResolvedValue({ data: [task] })
    setup()
    await waitFor(() =>
      expect(screen.getByText('(no description)')).toBeInTheDocument()
    )
  })

  it('clicking a task calls navigate with /tasks filtered to that day', async () => {
    const task = makeMondayTask()
    taskApi.listTasks.mockResolvedValue({ data: [task] })
    setup()
    await waitFor(() =>
      expect(screen.getByTestId(`week-task-${task.id}`)).toBeInTheDocument()
    )
    fireEvent.click(screen.getByTestId(`week-task-${task.id}`))
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringMatching(/^\/tasks\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/)
    )
  })

  it('pressing Enter on a task row also calls navigate with date filter', async () => {
    const task = makeMondayTask()
    taskApi.listTasks.mockResolvedValue({ data: [task] })
    setup()
    await waitFor(() =>
      expect(screen.getByTestId(`week-task-${task.id}`)).toBeInTheDocument()
    )
    fireEvent.keyDown(screen.getByTestId(`week-task-${task.id}`), { key: 'Enter' })
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringMatching(/^\/tasks\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/)
    )
  })

  it('shows loading indicator while fetching', async () => {
    let resolve
    taskApi.listTasks.mockReturnValueOnce(new Promise(r => { resolve = r }))
    setup()
    expect(screen.getByTestId('week-loading')).toBeInTheDocument()
    resolve({ data: [] })
    await waitFor(() =>
      expect(screen.queryByTestId('week-loading')).not.toBeInTheDocument()
    )
  })

  it('day column without tasks has empty class', async () => {
    setup()
    await waitFor(() => expect(screen.getByTestId('week-col-0')).toBeInTheDocument())
    expect(screen.getByTestId('week-col-0').className).toContain('empty')
  })

  it('day column with tasks does not have empty class', async () => {
    const task = makeMondayTask()
    taskApi.listTasks.mockResolvedValue({ data: [task] })
    setup()
    await waitFor(() =>
      expect(screen.getByTestId(`week-task-${task.id}`)).toBeInTheDocument()
    )
    expect(screen.getByTestId('week-col-0').className).not.toContain('empty')
  })

  it('week label contains year', async () => {
    setup()
    await waitFor(() => expect(screen.getByTestId('week-label')).toBeInTheDocument())
    const year = new Date().getFullYear().toString()
    expect(screen.getByTestId('week-label').textContent).toContain(year)
  })

  it('multiple tasks on same day add up in day total', async () => {
    const monday = getThisMonday()
    const task1 = {
      id: 10, description: 'Task 1', running: false, projects: [],
      startTime: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 9, 0, 0).toISOString(),
      endTime:   new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 10, 0, 0).toISOString(),
    }
    const task2 = {
      id: 11, description: 'Task 2', running: false, projects: [],
      startTime: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 11, 0, 0).toISOString(),
      endTime:   new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 12, 30, 0).toISOString(),
    }
    taskApi.listTasks.mockResolvedValue({ data: [task1, task2] })
    setup()
    await waitFor(() =>
      expect(screen.getByTestId('day-total-0').textContent).toBe('2h 30m')
    )
    expect(screen.getByTestId('week-total').textContent).toBe('2h 30m')
  })
})

// ─── Month view tests ────────────────────────────────────────────────────────

describe('OverviewPage — month view', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    taskApi.listTasks.mockResolvedValue({ data: [] })
  })

  async function switchToMonth() {
    setup()
    await waitFor(() => expect(screen.getByTestId('view-tab-month')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('view-tab-month'))
    await waitFor(() => expect(screen.getByTestId('month-view')).toBeInTheDocument())
  }

  it('clicking Month tab shows month-view grid', async () => {
    await switchToMonth()
    expect(screen.getByTestId('month-view')).toBeInTheDocument()
    expect(screen.queryByTestId('week-view')).not.toBeInTheDocument()
  })

  it('shows prev and next month buttons and month label', async () => {
    await switchToMonth()
    expect(screen.getByTestId('prev-month-btn')).toBeInTheDocument()
    expect(screen.getByTestId('next-month-btn')).toBeInTheDocument()
    expect(screen.getByTestId('month-label')).toBeInTheDocument()
  })

  it('month label contains current month name and year', async () => {
    await switchToMonth()
    const now = new Date()
    const monthName = now.toLocaleString('default', { month: 'long' })
    const year = now.getFullYear().toString()
    const label = screen.getByTestId('month-label').textContent
    expect(label).toContain(monthName)
    expect(label).toContain(year)
  })

  it('month label changes when clicking prev-month', async () => {
    await switchToMonth()
    const currentLabel = screen.getByTestId('month-label').textContent
    fireEvent.click(screen.getByTestId('prev-month-btn'))
    await waitFor(() =>
      expect(screen.getByTestId('month-label').textContent).not.toBe(currentLabel)
    )
  })

  it('month label changes when clicking next-month', async () => {
    await switchToMonth()
    const currentLabel = screen.getByTestId('month-label').textContent
    fireEvent.click(screen.getByTestId('next-month-btn'))
    await waitFor(() =>
      expect(screen.getByTestId('month-label').textContent).not.toBe(currentLabel)
    )
  })

  it('fetches tasks again when navigating months', async () => {
    await switchToMonth()
    const callsAfterSwitch = taskApi.listTasks.mock.calls.length
    fireEvent.click(screen.getByTestId('prev-month-btn'))
    await waitFor(() =>
      expect(taskApi.listTasks).toHaveBeenCalledTimes(callsAfterSwitch + 1)
    )
  })

  it('renders a day cell for the 1st of the current month', async () => {
    await switchToMonth()
    const ds = getCurrentMonthDay1Str()
    expect(screen.getByTestId(`month-day-${ds}`)).toBeInTheDocument()
  })

  it('all days in the current month have a cell', async () => {
    await switchToMonth()
    const now = new Date()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      expect(screen.getByTestId(`month-day-${ds}`)).toBeInTheDocument()
    }
  })

  it('shows — for month total when no tasks', async () => {
    await switchToMonth()
    expect(screen.getByTestId('month-total').textContent).toBe('—')
  })

  it('shows — in day cell when no tasks on that day', async () => {
    await switchToMonth()
    const ds = getCurrentMonthDay1Str()
    expect(screen.getByTestId(`month-day-total-${ds}`).textContent).toBe('—')
  })

  it('shows correct total in day cell when a task exists on that day', async () => {
    const task = makeMonthDay1Task()
    taskApi.listTasks.mockResolvedValue({ data: [task] })
    await switchToMonth()
    const ds = getCurrentMonthDay1Str()
    await waitFor(() =>
      expect(screen.getByTestId(`month-day-total-${ds}`).textContent).toBe('1h 00m')
    )
  })

  it('shows correct month total when tasks exist', async () => {
    const task = makeMonthDay1Task()
    taskApi.listTasks.mockResolvedValue({ data: [task] })
    await switchToMonth()
    await waitFor(() =>
      expect(screen.getByTestId('month-total').textContent).toBe('1h 00m')
    )
  })

  it('clicking a day cell opens the selected-day-panel', async () => {
    await switchToMonth()
    const ds = getCurrentMonthDay1Str()
    fireEvent.click(screen.getByTestId(`month-day-${ds}`))
    expect(screen.getByTestId('selected-day-panel')).toBeInTheDocument()
  })

  it('clicking the same day again closes the selected-day-panel', async () => {
    await switchToMonth()
    const ds = getCurrentMonthDay1Str()
    fireEvent.click(screen.getByTestId(`month-day-${ds}`))
    expect(screen.getByTestId('selected-day-panel')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId(`month-day-${ds}`))
    expect(screen.queryByTestId('selected-day-panel')).not.toBeInTheDocument()
  })

  it('shows empty message in panel when selected day has no tasks', async () => {
    await switchToMonth()
    const ds = getCurrentMonthDay1Str()
    fireEvent.click(screen.getByTestId(`month-day-${ds}`))
    expect(screen.getByTestId('selected-day-empty')).toBeInTheDocument()
  })

  it('shows tasks for selected day in the panel', async () => {
    const task = makeMonthDay1Task({ description: 'Panel task' })
    taskApi.listTasks.mockResolvedValue({ data: [task] })
    await switchToMonth()
    const ds = getCurrentMonthDay1Str()
    await waitFor(() =>
      expect(screen.getByTestId(`month-day-total-${ds}`).textContent).toBe('1h 00m')
    )
    fireEvent.click(screen.getByTestId(`month-day-${ds}`))
    expect(screen.getByTestId('selected-day-tasks')).toBeInTheDocument()
    expect(screen.getByTestId(`selected-day-task-${task.id}`)).toBeInTheDocument()
    expect(screen.getByText('Panel task')).toBeInTheDocument()
  })

  it('clicking a task in the panel navigates to /tasks filtered to that day', async () => {
    const task = makeMonthDay1Task()
    taskApi.listTasks.mockResolvedValue({ data: [task] })
    await switchToMonth()
    const ds = getCurrentMonthDay1Str()
    await waitFor(() =>
      expect(screen.getByTestId(`month-day-total-${ds}`).textContent).toBe('1h 00m')
    )
    fireEvent.click(screen.getByTestId(`month-day-${ds}`))
    fireEvent.click(screen.getByTestId(`selected-day-task-${task.id}`))
    expect(mockNavigate).toHaveBeenCalledWith(`/tasks?from=${ds}&to=${ds}`)
  })

  it('selected day has month-cell--selected class', async () => {
    await switchToMonth()
    const ds = getCurrentMonthDay1Str()
    fireEvent.click(screen.getByTestId(`month-day-${ds}`))
    expect(screen.getByTestId(`month-day-${ds}`).className).toContain('month-cell--selected')
  })

  it('selected-day-panel disappears when navigating to another month', async () => {
    await switchToMonth()
    const ds = getCurrentMonthDay1Str()
    fireEvent.click(screen.getByTestId(`month-day-${ds}`))
    expect(screen.getByTestId('selected-day-panel')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('prev-month-btn'))
    await waitFor(() =>
      expect(screen.queryByTestId('selected-day-panel')).not.toBeInTheDocument()
    )
  })

  it('shows loading indicator while fetching month tasks', async () => {
    let resolve
    taskApi.listTasks
      .mockResolvedValueOnce({ data: [] })   // initial week fetch
      .mockReturnValueOnce(new Promise(r => { resolve = r }))
    setup()
    await waitFor(() => expect(screen.getByTestId('view-tab-month')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('view-tab-month'))
    await waitFor(() => expect(screen.getByTestId('month-loading')).toBeInTheDocument())
    resolve({ data: [] })
    await waitFor(() =>
      expect(screen.queryByTestId('month-loading')).not.toBeInTheDocument()
    )
  })

  it('pressing Enter on a day cell opens the panel', async () => {
    await switchToMonth()
    const ds = getCurrentMonthDay1Str()
    fireEvent.keyDown(screen.getByTestId(`month-day-${ds}`), { key: 'Enter' })
    expect(screen.getByTestId('selected-day-panel')).toBeInTheDocument()
  })

  it('day cell with tasks has month-cell--has-tasks class', async () => {
    const task = makeMonthDay1Task()
    taskApi.listTasks.mockResolvedValue({ data: [task] })
    await switchToMonth()
    const ds = getCurrentMonthDay1Str()
    await waitFor(() =>
      expect(screen.getByTestId(`month-day-${ds}`).className).toContain('month-cell--has-tasks')
    )
  })

  it('day cell without tasks has month-cell--no-tasks class', async () => {
    await switchToMonth()
    const ds = getCurrentMonthDay1Str()
    expect(screen.getByTestId(`month-day-${ds}`).className).toContain('month-cell--no-tasks')
  })

  it('switching back to week tab shows week view', async () => {
    await switchToMonth()
    fireEvent.click(screen.getByTestId('view-tab-week'))
    await waitFor(() => expect(screen.getByTestId('week-view')).toBeInTheDocument())
    expect(screen.queryByTestId('month-view')).not.toBeInTheDocument()
  })
})
