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

function setup() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <OverviewPage />
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('OverviewPage', () => {
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

  it('clicking a task calls navigate with /tasks', async () => {
    const task = makeMondayTask()
    taskApi.listTasks.mockResolvedValue({ data: [task] })

    setup()
    await waitFor(() =>
      expect(screen.getByTestId(`week-task-${task.id}`)).toBeInTheDocument()
    )
    fireEvent.click(screen.getByTestId(`week-task-${task.id}`))
    expect(mockNavigate).toHaveBeenCalledWith('/tasks')
  })

  it('pressing Enter on a task row also calls navigate', async () => {
    const task = makeMondayTask()
    taskApi.listTasks.mockResolvedValue({ data: [task] })

    setup()
    await waitFor(() =>
      expect(screen.getByTestId(`week-task-${task.id}`)).toBeInTheDocument()
    )
    fireEvent.keyDown(screen.getByTestId(`week-task-${task.id}`), { key: 'Enter' })
    expect(mockNavigate).toHaveBeenCalledWith('/tasks')
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

  it('switching to Month tab shows month placeholder', async () => {
    setup()
    await waitFor(() => expect(screen.getByTestId('view-tab-month')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('view-tab-month'))
    expect(screen.getByTestId('month-placeholder')).toBeInTheDocument()
    expect(screen.queryByTestId('week-view')).not.toBeInTheDocument()
  })

  it('switching back to Week tab shows week view again', async () => {
    setup()
    await waitFor(() => expect(screen.getByTestId('view-tab-month')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('view-tab-month'))
    fireEvent.click(screen.getByTestId('view-tab-week'))
    await waitFor(() => expect(screen.getByTestId('week-view')).toBeInTheDocument())
    expect(screen.queryByTestId('month-placeholder')).not.toBeInTheDocument()
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
