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

  it('clicking Edit button shows pre-populated edit form', async () => {
    taskApi.listTasks.mockResolvedValueOnce({
      data: [{ id: 5, description: 'Old desc', startTime: PAST_START, endTime: PAST_END, running: false }]
    })
    setup()
    await waitFor(() => screen.getByTestId('edit-btn-5'))
    fireEvent.click(screen.getByTestId('edit-btn-5'))

    expect(screen.getByTestId('edit-form-5')).toBeInTheDocument()
    expect(screen.getByTestId('edit-desc-input').value).toBe('Old desc')
  })

  it('cancel edit button hides edit form', async () => {
    taskApi.listTasks.mockResolvedValueOnce({
      data: [{ id: 6, description: 'Task', startTime: PAST_START, endTime: PAST_END, running: false }]
    })
    setup()
    await waitFor(() => screen.getByTestId('edit-btn-6'))
    fireEvent.click(screen.getByTestId('edit-btn-6'))
    expect(screen.getByTestId('edit-form-6')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('cancel-edit-btn'))
    expect(screen.queryByTestId('edit-form-6')).not.toBeInTheDocument()
  })

  it('shows client error when edit start >= end', async () => {
    taskApi.listTasks.mockResolvedValueOnce({
      data: [{ id: 7, description: 'T', startTime: PAST_START, endTime: PAST_END, running: false }]
    })
    setup()
    await waitFor(() => screen.getByTestId('edit-btn-7'))
    fireEvent.click(screen.getByTestId('edit-btn-7'))

    const now   = new Date()
    const later = new Date(now.getTime() + 3600000)
    const fmt   = d => d.toISOString().slice(0, 16)

    fireEvent.change(screen.getByTestId('edit-start-input'), { target: { value: fmt(later) } })
    fireEvent.change(screen.getByTestId('edit-end-input'),   { target: { value: fmt(now) } })
    fireEvent.click(screen.getByTestId('save-edit-btn'))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('before end')
    )
    expect(taskApi.updateTask).not.toHaveBeenCalled()
  })

  it('calls updateTask API and refreshes list on valid edit', async () => {
    taskApi.listTasks
      .mockResolvedValueOnce({
        data: [{ id: 8, description: 'Original', startTime: PAST_START, endTime: PAST_END, running: false }]
      })
      .mockResolvedValueOnce({
        data: [{ id: 8, description: 'Updated', startTime: PAST_START, endTime: PAST_END, running: false }]
      })
    taskApi.updateTask.mockResolvedValueOnce({ data: { id: 8 } })

    setup()
    await waitFor(() => screen.getByTestId('edit-btn-8'))
    fireEvent.click(screen.getByTestId('edit-btn-8'))

    fireEvent.change(screen.getByTestId('edit-desc-input'), { target: { value: 'Updated' } })
    fireEvent.click(screen.getByTestId('save-edit-btn'))

    await waitFor(() => expect(taskApi.updateTask).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText('Updated')).toBeInTheDocument())
  })

  it('shows API error on failed update', async () => {
    taskApi.listTasks.mockResolvedValueOnce({
      data: [{ id: 9, description: 'Task', startTime: PAST_START, endTime: PAST_END, running: false }]
    })
    taskApi.updateTask.mockRejectedValueOnce({
      response: { data: { message: 'Task not found.' } }
    })

    setup()
    await waitFor(() => screen.getByTestId('edit-btn-9'))
    fireEvent.click(screen.getByTestId('edit-btn-9'))
    fireEvent.click(screen.getByTestId('save-edit-btn'))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Task not found.')
    )
  })
})
