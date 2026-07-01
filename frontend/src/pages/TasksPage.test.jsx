import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TasksPage from './TasksPage'
import { AuthProvider } from '../context/AuthContext'
import * as taskApi from '../api/taskApi'
import * as projectApi from '../api/projectApi'

vi.mock('../api/taskApi')
vi.mock('../api/projectApi')

const NOW = new Date().toISOString()

const PROJECTS = [
  { id: 100, name: 'Thesis', description: null, subprojects: [], totalSeconds: 0, createdAt: NOW },
  { id: 101, name: 'Work',   description: null, subprojects: [], totalSeconds: 0, createdAt: NOW }
]

const PROJECT_WITH_CHILD = [
  {
    id: 200, name: 'Parent', description: null, totalSeconds: 0, createdAt: NOW,
    subprojects: [
      { id: 201, name: 'Child', description: null, subprojects: [], totalSeconds: 0, createdAt: NOW }
    ]
  }
]

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
    projectApi.listProjects.mockResolvedValue({ data: [] })
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
        { id: 1, description: 'Meeting', startTime: PAST_START, endTime: PAST_END, running: false, projects: [] },
        { id: 2, description: null,      startTime: PAST_START, endTime: PAST_END, running: false, projects: [] }
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
      .mockResolvedValueOnce({ data: [{ id: 3, description: 'Study', startTime: PAST_START, endTime: PAST_END, running: false, projects: [] }] })
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
      data: [{ id: 5, description: 'Old desc', startTime: PAST_START, endTime: PAST_END, running: false, projects: [] }]
    })
    setup()
    await waitFor(() => screen.getByTestId('edit-btn-5'))
    fireEvent.click(screen.getByTestId('edit-btn-5'))

    expect(screen.getByTestId('edit-form-5')).toBeInTheDocument()
    expect(screen.getByTestId('edit-desc-input').value).toBe('Old desc')
  })

  it('cancel edit button hides edit form', async () => {
    taskApi.listTasks.mockResolvedValueOnce({
      data: [{ id: 6, description: 'Task', startTime: PAST_START, endTime: PAST_END, running: false, projects: [] }]
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
      data: [{ id: 7, description: 'T', startTime: PAST_START, endTime: PAST_END, running: false, projects: [] }]
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
        data: [{ id: 8, description: 'Original', startTime: PAST_START, endTime: PAST_END, running: false, projects: [] }]
      })
      .mockResolvedValueOnce({
        data: [{ id: 8, description: 'Updated', startTime: PAST_START, endTime: PAST_END, running: false, projects: [] }]
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
      data: [{ id: 9, description: 'Task', startTime: PAST_START, endTime: PAST_END, running: false, projects: [] }]
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

  it('canceling delete confirmation leaves task intact', async () => {
    taskApi.listTasks.mockResolvedValueOnce({
      data: [{ id: 10, description: 'Keep me', startTime: PAST_START, endTime: PAST_END, running: false, projects: [] }]
    })
    window.confirm = vi.fn().mockReturnValue(false)

    setup()
    await waitFor(() => screen.getByTestId('delete-btn-10'))
    fireEvent.click(screen.getByTestId('delete-btn-10'))

    expect(taskApi.deleteTask).not.toHaveBeenCalled()
    expect(screen.getByText('Keep me')).toBeInTheDocument()
  })

  it('confirming delete calls deleteTask API and removes task from list', async () => {
    taskApi.listTasks
      .mockResolvedValueOnce({
        data: [{ id: 11, description: 'Delete me', startTime: PAST_START, endTime: PAST_END, running: false, projects: [] }]
      })
      .mockResolvedValueOnce({ data: [] })
    taskApi.deleteTask.mockResolvedValueOnce({})
    window.confirm = vi.fn().mockReturnValue(true)

    setup()
    await waitFor(() => screen.getByTestId('delete-btn-11'))
    fireEvent.click(screen.getByTestId('delete-btn-11'))

    await waitFor(() => expect(taskApi.deleteTask).toHaveBeenCalledWith(11))
    await waitFor(() => expect(screen.queryByText('Delete me')).not.toBeInTheDocument())
  })

  // --- project association (US-013) ---

  it('shows project checkboxes in add task form when projects exist', async () => {
    taskApi.listTasks.mockResolvedValueOnce({ data: [] })
    projectApi.listProjects.mockResolvedValue({ data: PROJECTS })

    setup()
    await waitFor(() => screen.getByTestId('add-task-btn'))
    fireEvent.click(screen.getByTestId('add-task-btn'))

    await waitFor(() =>
      expect(screen.getByTestId('create-project-selector')).toBeInTheDocument()
    )
    expect(screen.getByTestId('create-project-checkbox-100')).toBeInTheDocument()
    expect(screen.getByTestId('create-project-checkbox-101')).toBeInTheDocument()
  })

  it('shows subproject indented in tree within selector', async () => {
    taskApi.listTasks.mockResolvedValueOnce({ data: [] })
    projectApi.listProjects.mockResolvedValue({ data: PROJECT_WITH_CHILD })

    setup()
    await waitFor(() => screen.getByTestId('add-task-btn'))
    fireEvent.click(screen.getByTestId('add-task-btn'))

    await waitFor(() => screen.getByTestId('create-project-selector'))
    expect(screen.getByTestId('create-project-checkbox-200')).toBeInTheDocument()
    expect(screen.getByTestId('create-project-checkbox-201')).toBeInTheDocument()
  })

  it('create task with selected project calls createTask with projectIds', async () => {
    taskApi.listTasks
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })
    taskApi.createTask.mockResolvedValueOnce({ data: { id: 20 } })
    projectApi.listProjects.mockResolvedValue({ data: PROJECTS })

    setup()
    await waitFor(() => screen.getByTestId('add-task-btn'))
    fireEvent.click(screen.getByTestId('add-task-btn'))

    await waitFor(() => screen.getByTestId('create-project-checkbox-100'))

    const startVal = new Date(Date.now() - 7200000).toISOString().slice(0, 16)
    const endVal   = new Date(Date.now() - 3600000).toISOString().slice(0, 16)
    fireEvent.change(screen.getByTestId('task-start-input'), { target: { value: startVal } })
    fireEvent.change(screen.getByTestId('task-end-input'),   { target: { value: endVal } })
    fireEvent.click(screen.getByTestId('create-project-checkbox-100'))

    fireEvent.click(screen.getByTestId('submit-task-btn'))

    await waitFor(() =>
      expect(taskApi.createTask).toHaveBeenCalledWith(null, expect.any(String), expect.any(String), [100])
    )
  })

  it('create task with no project selected calls createTask with null projectIds', async () => {
    taskApi.listTasks
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })
    taskApi.createTask.mockResolvedValueOnce({ data: { id: 21 } })
    projectApi.listProjects.mockResolvedValue({ data: PROJECTS })

    setup()
    await waitFor(() => screen.getByTestId('add-task-btn'))
    fireEvent.click(screen.getByTestId('add-task-btn'))

    const startVal = new Date(Date.now() - 7200000).toISOString().slice(0, 16)
    const endVal   = new Date(Date.now() - 3600000).toISOString().slice(0, 16)
    fireEvent.change(screen.getByTestId('task-start-input'), { target: { value: startVal } })
    fireEvent.change(screen.getByTestId('task-end-input'),   { target: { value: endVal } })
    fireEvent.click(screen.getByTestId('submit-task-btn'))

    await waitFor(() =>
      expect(taskApi.createTask).toHaveBeenCalledWith(null, expect.any(String), expect.any(String), null)
    )
  })

  it('task row displays associated project names', async () => {
    taskApi.listTasks.mockResolvedValueOnce({
      data: [{
        id: 30,
        description: 'Study',
        startTime: PAST_START,
        endTime: PAST_END,
        running: false,
        projects: [{ id: 100, name: 'Thesis' }]
      }]
    })

    setup()
    await waitFor(() =>
      expect(screen.getByTestId('task-projects-30')).toHaveTextContent('Thesis')
    )
  })

  it('task row with multiple projects shows all names', async () => {
    taskApi.listTasks.mockResolvedValueOnce({
      data: [{
        id: 31,
        description: 'Work',
        startTime: PAST_START,
        endTime: PAST_END,
        running: false,
        projects: [{ id: 100, name: 'Thesis' }, { id: 101, name: 'Work' }]
      }]
    })

    setup()
    await waitFor(() => {
      const el = screen.getByTestId('task-projects-31')
      expect(el).toHaveTextContent('Thesis')
      expect(el).toHaveTextContent('Work')
    })
  })

  it('task row with no projects shows no project span', async () => {
    taskApi.listTasks.mockResolvedValueOnce({
      data: [{ id: 32, description: 'Solo', startTime: PAST_START, endTime: PAST_END, running: false, projects: [] }]
    })

    setup()
    await waitFor(() => screen.getByTestId('task-item-32'))
    expect(screen.queryByTestId('task-projects-32')).not.toBeInTheDocument()
  })

  it('edit form shows project checkboxes pre-populated from task.projects', async () => {
    taskApi.listTasks.mockResolvedValueOnce({
      data: [{
        id: 40,
        description: 'Study',
        startTime: PAST_START,
        endTime: PAST_END,
        running: false,
        projects: [{ id: 100, name: 'Thesis' }]
      }]
    })
    projectApi.listProjects.mockResolvedValue({ data: PROJECTS })

    setup()
    await waitFor(() => screen.getByTestId('edit-btn-40'))
    fireEvent.click(screen.getByTestId('edit-btn-40'))

    await waitFor(() => screen.getByTestId('edit-project-selector'))
    expect(screen.getByTestId('edit-project-checkbox-100').checked).toBe(true)
    expect(screen.getByTestId('edit-project-checkbox-101').checked).toBe(false)
  })

  it('update task passes selected projectIds to updateTask', async () => {
    taskApi.listTasks
      .mockResolvedValueOnce({
        data: [{ id: 41, description: 'Task', startTime: PAST_START, endTime: PAST_END, running: false, projects: [] }]
      })
      .mockResolvedValueOnce({ data: [] })
    taskApi.updateTask.mockResolvedValueOnce({ data: { id: 41 } })
    projectApi.listProjects.mockResolvedValue({ data: PROJECTS })

    setup()
    await waitFor(() => screen.getByTestId('edit-btn-41'))
    fireEvent.click(screen.getByTestId('edit-btn-41'))

    await waitFor(() => screen.getByTestId('edit-project-selector'))
    fireEvent.click(screen.getByTestId('edit-project-checkbox-101'))
    fireEvent.click(screen.getByTestId('save-edit-btn'))

    await waitFor(() =>
      expect(taskApi.updateTask).toHaveBeenCalledWith(
        41,
        expect.anything(),
        expect.any(String),
        expect.any(String),
        [101]
      )
    )
  })

  it('update task with no projects selected passes null projectIds', async () => {
    taskApi.listTasks
      .mockResolvedValueOnce({
        data: [{ id: 42, description: 'Task', startTime: PAST_START, endTime: PAST_END, running: false, projects: [] }]
      })
      .mockResolvedValueOnce({ data: [] })
    taskApi.updateTask.mockResolvedValueOnce({ data: { id: 42 } })
    projectApi.listProjects.mockResolvedValue({ data: PROJECTS })

    setup()
    await waitFor(() => screen.getByTestId('edit-btn-42'))
    fireEvent.click(screen.getByTestId('edit-btn-42'))

    fireEvent.click(screen.getByTestId('save-edit-btn'))

    await waitFor(() =>
      expect(taskApi.updateTask).toHaveBeenCalledWith(
        42,
        expect.anything(),
        expect.any(String),
        expect.any(String),
        null
      )
    )
  })
})

// ── US-019: Search and Filter ──────────────────────────────
describe('TasksPage — search and filter', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    projectApi.listProjects.mockResolvedValue({ data: PROJECTS })
  })

  it('renders filter panel with all controls', async () => {
    taskApi.listTasks.mockResolvedValue({ data: [] })
    setup()
    expect(screen.getByTestId('filter-panel')).toBeInTheDocument()
    expect(screen.getByTestId('filter-search-input')).toBeInTheDocument()
    expect(screen.getByTestId('filter-project-select')).toBeInTheDocument()
    expect(screen.getByTestId('filter-from')).toBeInTheDocument()
    expect(screen.getByTestId('filter-to')).toBeInTheDocument()
    expect(screen.getByTestId('filter-reset-btn')).toBeInTheDocument()
  })

  it('passes search keyword to listTasks after debounce', async () => {
    taskApi.listTasks.mockResolvedValue({ data: [] })
    setup()
    await waitFor(() => expect(taskApi.listTasks).toHaveBeenCalled())

    fireEvent.change(screen.getByTestId('filter-search-input'), { target: { value: 'research' } })

    await waitFor(() => {
      const calls = taskApi.listTasks.mock.calls
      const last = calls[calls.length - 1]
      expect(last[2]).toBe('research')
    }, { timeout: 1000 })
  })

  it('passes projectId to listTasks when project selected', async () => {
    taskApi.listTasks.mockResolvedValue({ data: [] })
    setup()
    await waitFor(() => expect(taskApi.listTasks).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByTestId('filter-project-select')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('filter-project-select'), { target: { value: '100' } })

    await waitFor(() => {
      const calls = taskApi.listTasks.mock.calls
      const last = calls[calls.length - 1]
      expect(last[3]).toBe('100')
    })
  })

  it('passes date range to listTasks when from/to set', async () => {
    taskApi.listTasks.mockResolvedValue({ data: [] })
    setup()
    await waitFor(() => expect(taskApi.listTasks).toHaveBeenCalled())

    fireEvent.change(screen.getByTestId('filter-from'), { target: { value: '2026-06-01' } })
    fireEvent.change(screen.getByTestId('filter-to'),   { target: { value: '2026-06-30' } })

    await waitFor(() => {
      const calls = taskApi.listTasks.mock.calls
      const last = calls[calls.length - 1]
      expect(last[0]).toContain('2026-06-01')
      expect(last[1]).toContain('2026-06-30')
    })
  })

  it('shows no-tasks-message when filtered results are empty', async () => {
    taskApi.listTasks.mockResolvedValue({ data: [] })
    setup()
    await waitFor(() => expect(taskApi.listTasks).toHaveBeenCalled())

    fireEvent.change(screen.getByTestId('filter-search-input'), { target: { value: 'xyz' } })

    await waitFor(() => {
      expect(screen.getByTestId('no-tasks-message')).toBeInTheDocument()
    }, { timeout: 1000 })
  })

  it('shows match message when filter yields no results', async () => {
    taskApi.listTasks.mockResolvedValue({ data: [] })
    setup()
    await waitFor(() => expect(taskApi.listTasks).toHaveBeenCalled())

    fireEvent.change(screen.getByTestId('filter-search-input'), { target: { value: 'xyz' } })

    await waitFor(() => {
      const msg = screen.getByTestId('no-tasks-message')
      expect(msg).toHaveTextContent('No tasks match')
    }, { timeout: 1000 })
  })

  it('reset button clears search input', async () => {
    taskApi.listTasks.mockResolvedValue({ data: [] })
    setup()
    await waitFor(() => expect(taskApi.listTasks).toHaveBeenCalled())

    fireEvent.change(screen.getByTestId('filter-search-input'), { target: { value: 'test' } })
    expect(screen.getByTestId('filter-search-input')).toHaveValue('test')

    fireEvent.click(screen.getByTestId('filter-reset-btn'))
    expect(screen.getByTestId('filter-search-input')).toHaveValue('')
  })

  it('reset button clears project select', async () => {
    taskApi.listTasks.mockResolvedValue({ data: [] })
    setup()
    await waitFor(() => expect(screen.getByTestId('filter-project-select')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('filter-project-select'), { target: { value: '100' } })
    expect(screen.getByTestId('filter-project-select')).toHaveValue('100')

    fireEvent.click(screen.getByTestId('filter-reset-btn'))
    expect(screen.getByTestId('filter-project-select')).toHaveValue('')
  })

  it('reset button refetches with no filters', async () => {
    taskApi.listTasks.mockResolvedValue({ data: [] })
    setup()
    await waitFor(() => expect(taskApi.listTasks).toHaveBeenCalled())

    // Use date filter (no debounce) to trigger an extra fetch, then reset
    fireEvent.change(screen.getByTestId('filter-from'), { target: { value: '2026-06-01' } })
    await waitFor(() => {
      const calls = taskApi.listTasks.mock.calls
      expect(calls[calls.length - 1][0]).toContain('2026-06-01')
    })

    fireEvent.click(screen.getByTestId('filter-reset-btn'))

    await waitFor(() => {
      const calls = taskApi.listTasks.mock.calls
      const last = calls[calls.length - 1]
      expect(last[0]).toBeFalsy()
      expect(last[2]).toBeFalsy()
    })
  })

  it('project dropdown is populated with available projects', async () => {
    taskApi.listTasks.mockResolvedValue({ data: [] })
    setup()
    await waitFor(() => expect(screen.getByTestId('filter-project-select')).toBeInTheDocument())
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Thesis/ })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: /Work/ })).toBeInTheDocument()
    })
  })
})
