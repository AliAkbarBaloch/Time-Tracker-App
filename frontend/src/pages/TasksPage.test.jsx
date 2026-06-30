import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TasksPage from './TasksPage'
import { AuthProvider } from '../context/AuthContext'
import * as taskApi from '../api/taskApi'

vi.mock('../api/taskApi')

function setup() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <TasksPage />
      </AuthProvider>
    </MemoryRouter>
  )
}

const PAST_START = new Date(Date.now() - 7200000).toISOString()
const PAST_END   = new Date(Date.now() - 3600000).toISOString()

describe('TasksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('shows empty state when no tasks', async () => {
    taskApi.listTasks.mockResolvedValueOnce({ data: [] })
    setup()
    await waitFor(() =>
      expect(screen.getByText(/No tasks yet/i)).toBeInTheDocument()
    )
  })

  it('renders tasks loaded from API', async () => {
    taskApi.listTasks.mockResolvedValueOnce({
      data: [
        { id: 1, description: 'Meeting', startTime: PAST_START, endTime: PAST_END, running: false },
        { id: 2, description: null,      startTime: PAST_START, endTime: PAST_END, running: false }
      ]
    })
    setup()
    await waitFor(() => {
      expect(screen.getByText('Meeting')).toBeInTheDocument()
      expect(screen.getByText('(no description)')).toBeInTheDocument()
    })
  })

  it('shows add-task form when button clicked', async () => {
    taskApi.listTasks.mockResolvedValueOnce({ data: [] })
    setup()
    await waitFor(() => screen.getByTestId('add-task-btn'))
    fireEvent.click(screen.getByTestId('add-task-btn'))
    expect(screen.getByTestId('add-task-form')).toBeInTheDocument()
  })

  it('shows client error when start >= end', async () => {
    taskApi.listTasks.mockResolvedValueOnce({ data: [] })
    setup()
    await waitFor(() => screen.getByTestId('add-task-btn'))
    fireEvent.click(screen.getByTestId('add-task-btn'))

    const now = new Date()
    const later = new Date(now.getTime() + 3600000)
    const fmt = d => d.toISOString().slice(0, 16)

    fireEvent.change(screen.getByTestId('task-start-input'), { target: { value: fmt(later) } })
    fireEvent.change(screen.getByTestId('task-end-input'),   { target: { value: fmt(now) } })
    fireEvent.click(screen.getByTestId('submit-task-btn'))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('before end')
    )
    expect(taskApi.createTask).not.toHaveBeenCalled()
  })

  it('calls createTask API and refreshes list on valid submit', async () => {
    taskApi.listTasks
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [{ id: 3, description: 'Study', startTime: PAST_START, endTime: PAST_END, running: false }] })
    taskApi.createTask.mockResolvedValueOnce({ data: { id: 3 } })

    setup()
    await waitFor(() => screen.getByTestId('add-task-btn'))
    fireEvent.click(screen.getByTestId('add-task-btn'))

    const startVal = new Date(Date.now() - 7200000).toISOString().slice(0, 16)
    const endVal   = new Date(Date.now() - 3600000).toISOString().slice(0, 16)

    fireEvent.change(screen.getByTestId('task-desc-input'),  { target: { value: 'Study' } })
    fireEvent.change(screen.getByTestId('task-start-input'), { target: { value: startVal } })
    fireEvent.change(screen.getByTestId('task-end-input'),   { target: { value: endVal } })
    fireEvent.click(screen.getByTestId('submit-task-btn'))

    await waitFor(() => expect(taskApi.createTask).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText('Study')).toBeInTheDocument())
  })

  it('shows API error on failed create', async () => {
    taskApi.listTasks.mockResolvedValueOnce({ data: [] })
    taskApi.createTask.mockRejectedValueOnce({
      response: { data: { message: 'Start time must be before end time.' } }
    })

    setup()
    await waitFor(() => screen.getByTestId('add-task-btn'))
    fireEvent.click(screen.getByTestId('add-task-btn'))

    const startVal = new Date(Date.now() - 7200000).toISOString().slice(0, 16)
    const endVal   = new Date(Date.now() - 3600000).toISOString().slice(0, 16)

    fireEvent.change(screen.getByTestId('task-start-input'), { target: { value: startVal } })
    fireEvent.change(screen.getByTestId('task-end-input'),   { target: { value: endVal } })
    fireEvent.click(screen.getByTestId('submit-task-btn'))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('before end')
    )
  })
})
