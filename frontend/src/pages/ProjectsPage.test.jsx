import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ProjectsPage from './ProjectsPage'
import { AuthProvider } from '../context/AuthContext'
import * as projectApi from '../api/projectApi'

vi.mock('../api/projectApi')

function setup() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ProjectsPage />
      </AuthProvider>
    </MemoryRouter>
  )
}

const NOW = new Date().toISOString()

const PROJECT = { id: 1, name: 'Thesis', description: 'My thesis', subprojects: [], totalSeconds: 0, createdAt: NOW }

describe('ProjectsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders empty state when no projects', async () => {
    projectApi.listProjects.mockResolvedValueOnce({ data: [] })
    setup()
    await waitFor(() =>
      expect(screen.getByText(/No projects yet/i)).toBeInTheDocument()
    )
  })

  it('renders projects loaded from API', async () => {
    projectApi.listProjects.mockResolvedValueOnce({
      data: [
        { id: 1, name: 'Thesis', description: 'My thesis', subprojects: [], totalSeconds: 0, createdAt: NOW },
        { id: 2, name: 'Work',   description: null,        subprojects: [], totalSeconds: 0, createdAt: NOW }
      ]
    })
    setup()
    await waitFor(() => {
      expect(screen.getByTestId('project-name-1')).toHaveTextContent('Thesis')
      expect(screen.getByTestId('project-name-2')).toHaveTextContent('Work')
    })
  })

  it('shows create form when New Project button clicked', async () => {
    projectApi.listProjects.mockResolvedValueOnce({ data: [] })
    setup()
    await waitFor(() => screen.getByTestId('new-project-btn'))
    fireEvent.click(screen.getByTestId('new-project-btn'))
    expect(screen.getByTestId('project-form')).toBeInTheDocument()
    expect(screen.getByTestId('project-name-input')).toBeInTheDocument()
    expect(screen.getByTestId('parent-project-select')).toBeInTheDocument()
  })

  it('calls createProject with null parentProjectId for top-level and refreshes list', async () => {
    projectApi.listProjects
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [{ id: 1, name: 'NewProject', description: null, subprojects: [], totalSeconds: 0, createdAt: NOW }] })
    projectApi.createProject.mockResolvedValueOnce({ data: { id: 1, name: 'NewProject' } })

    setup()
    await waitFor(() => screen.getByTestId('new-project-btn'))
    fireEvent.click(screen.getByTestId('new-project-btn'))

    fireEvent.change(screen.getByTestId('project-name-input'), { target: { value: 'NewProject' } })
    fireEvent.click(screen.getByTestId('create-project-btn'))

    await waitFor(() => expect(projectApi.createProject).toHaveBeenCalledWith('NewProject', null, null))
    await waitFor(() => expect(screen.getByTestId('project-name-1')).toBeInTheDocument())
  })

  it('passes parentProjectId when a parent is selected', async () => {
    projectApi.listProjects
      .mockResolvedValueOnce({
        data: [{ id: 5, name: 'Parent', description: null, subprojects: [], totalSeconds: 0, createdAt: NOW }]
      })
      .mockResolvedValueOnce({ data: [] })
    projectApi.createProject.mockResolvedValueOnce({ data: { id: 6, name: 'Child' } })

    setup()
    await waitFor(() => screen.getByTestId('new-project-btn'))
    fireEvent.click(screen.getByTestId('new-project-btn'))

    fireEvent.change(screen.getByTestId('project-name-input'), { target: { value: 'Child' } })
    fireEvent.change(screen.getByTestId('parent-project-select'), { target: { value: '5' } })
    fireEvent.click(screen.getByTestId('create-project-btn'))

    await waitFor(() => expect(projectApi.createProject).toHaveBeenCalledWith('Child', null, 5))
  })

  it('shows subprojects nested in tree', async () => {
    projectApi.listProjects.mockResolvedValueOnce({
      data: [{
        id: 10, name: 'Lecture', description: null, totalSeconds: 3600, createdAt: NOW,
        subprojects: [{
          id: 11, name: 'Assignment 1', description: null, totalSeconds: 1800, createdAt: NOW,
          subprojects: []
        }]
      }]
    })
    setup()
    await waitFor(() => {
      expect(screen.getByTestId('project-name-10')).toHaveTextContent('Lecture')
      expect(screen.getByTestId('project-name-11')).toHaveTextContent('Assignment 1')
    })
  })

  it('collapse button toggles subproject visibility', async () => {
    projectApi.listProjects.mockResolvedValueOnce({
      data: [{
        id: 20, name: 'Parent', description: null, totalSeconds: 0, createdAt: NOW,
        subprojects: [{ id: 21, name: 'Child', description: null, totalSeconds: 0, createdAt: NOW, subprojects: [] }]
      }]
    })
    setup()
    await waitFor(() => screen.getByTestId('collapse-btn-20'))
    expect(screen.getByTestId('project-name-21')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('collapse-btn-20'))
    expect(screen.queryByTestId('project-name-21')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('collapse-btn-20'))
    expect(screen.getByTestId('project-name-21')).toBeInTheDocument()
  })

  it('shows error when createProject returns 409', async () => {
    projectApi.listProjects.mockResolvedValueOnce({ data: [] })
    projectApi.createProject.mockRejectedValueOnce({
      response: { data: { message: 'A project named "Dup" already exists.' } }
    })

    setup()
    await waitFor(() => screen.getByTestId('new-project-btn'))
    fireEvent.click(screen.getByTestId('new-project-btn'))

    fireEvent.change(screen.getByTestId('project-name-input'), { target: { value: 'Dup' } })
    fireEvent.click(screen.getByTestId('create-project-btn'))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('already exists')
    )
  })

  it('hides form after successful creation', async () => {
    projectApi.listProjects
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [{ id: 1, name: 'Done', description: null, subprojects: [], totalSeconds: 0, createdAt: NOW }] })
    projectApi.createProject.mockResolvedValueOnce({ data: { id: 1, name: 'Done' } })

    setup()
    await waitFor(() => screen.getByTestId('new-project-btn'))
    fireEvent.click(screen.getByTestId('new-project-btn'))
    fireEvent.change(screen.getByTestId('project-name-input'), { target: { value: 'Done' } })
    fireEvent.click(screen.getByTestId('create-project-btn'))

    await waitFor(() => expect(screen.queryByTestId('project-form')).not.toBeInTheDocument())
  })

  it('displays totalSeconds as formatted duration', async () => {
    projectApi.listProjects.mockResolvedValueOnce({
      data: [{ id: 30, name: 'Timed', description: null, subprojects: [], totalSeconds: 7200, createdAt: NOW }]
    })
    setup()
    await waitFor(() =>
      expect(screen.getByTestId('project-total-30')).toHaveTextContent('2h 0m')
    )
  })

  // --- Edit ---

  it('clicking Edit shows pre-populated inline edit form', async () => {
    projectApi.listProjects.mockResolvedValueOnce({ data: [PROJECT] })
    setup()
    await waitFor(() => screen.getByTestId('edit-project-btn-1'))
    fireEvent.click(screen.getByTestId('edit-project-btn-1'))

    expect(screen.getByTestId('edit-form-1')).toBeInTheDocument()
    expect(screen.getByTestId('edit-project-name-input').value).toBe('Thesis')
    expect(screen.getByTestId('edit-project-desc-input').value).toBe('My thesis')
  })

  it('cancel edit hides the edit form', async () => {
    projectApi.listProjects.mockResolvedValueOnce({ data: [PROJECT] })
    setup()
    await waitFor(() => screen.getByTestId('edit-project-btn-1'))
    fireEvent.click(screen.getByTestId('edit-project-btn-1'))
    expect(screen.getByTestId('edit-form-1')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('cancel-project-edit-btn'))
    expect(screen.queryByTestId('edit-form-1')).not.toBeInTheDocument()
  })

  it('save edit calls updateProject and refreshes', async () => {
    projectApi.listProjects
      .mockResolvedValueOnce({ data: [PROJECT] })
      .mockResolvedValueOnce({ data: [{ ...PROJECT, name: 'Updated' }] })
    projectApi.updateProject.mockResolvedValueOnce({ data: { ...PROJECT, name: 'Updated' } })

    setup()
    await waitFor(() => screen.getByTestId('edit-project-btn-1'))
    fireEvent.click(screen.getByTestId('edit-project-btn-1'))

    fireEvent.change(screen.getByTestId('edit-project-name-input'), { target: { value: 'Updated' } })
    fireEvent.click(screen.getByTestId('save-project-edit-btn'))

    await waitFor(() => expect(projectApi.updateProject).toHaveBeenCalledWith(1, 'Updated', 'My thesis'))
  })

  it('shows error when updateProject returns duplicate name', async () => {
    projectApi.listProjects.mockResolvedValueOnce({ data: [PROJECT] })
    projectApi.updateProject.mockRejectedValueOnce({
      response: { data: { message: 'A project named "Other" already exists.' } }
    })

    setup()
    await waitFor(() => screen.getByTestId('edit-project-btn-1'))
    fireEvent.click(screen.getByTestId('edit-project-btn-1'))
    fireEvent.click(screen.getByTestId('save-project-edit-btn'))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('already exists')
    )
  })

  // --- Delete ---

  it('delete with no associations calls deleteProject and refreshes', async () => {
    projectApi.listProjects
      .mockResolvedValueOnce({ data: [PROJECT] })
      .mockResolvedValueOnce({ data: [] })
    projectApi.deleteProject.mockResolvedValueOnce({})

    setup()
    await waitFor(() => screen.getByTestId('delete-project-btn-1'))
    fireEvent.click(screen.getByTestId('delete-project-btn-1'))

    await waitFor(() => expect(projectApi.deleteProject).toHaveBeenCalledWith(1, false))
    await waitFor(() => expect(screen.queryByTestId('project-name-1')).not.toBeInTheDocument())
  })

  it('delete with 409 shows warning dialog', async () => {
    projectApi.listProjects.mockResolvedValueOnce({ data: [PROJECT] })
    projectApi.deleteProject.mockRejectedValueOnce({
      response: { status: 409, data: { message: 'Has tasks', taskCount: 2, subprojectCount: 0 } }
    })

    setup()
    await waitFor(() => screen.getByTestId('delete-project-btn-1'))
    fireEvent.click(screen.getByTestId('delete-project-btn-1'))

    await waitFor(() =>
      expect(screen.getByTestId('delete-warning-dialog')).toBeInTheDocument()
    )
    expect(screen.getByText(/2/)).toBeInTheDocument()
  })

  it('cancel warning dialog leaves project intact', async () => {
    projectApi.listProjects.mockResolvedValueOnce({ data: [PROJECT] })
    projectApi.deleteProject.mockRejectedValueOnce({
      response: { status: 409, data: { message: 'Has tasks', taskCount: 1, subprojectCount: 0 } }
    })

    setup()
    await waitFor(() => screen.getByTestId('delete-project-btn-1'))
    fireEvent.click(screen.getByTestId('delete-project-btn-1'))
    await waitFor(() => screen.getByTestId('delete-warning-dialog'))

    fireEvent.click(screen.getByTestId('cancel-force-delete-btn'))
    expect(screen.queryByTestId('delete-warning-dialog')).not.toBeInTheDocument()
    expect(projectApi.deleteProject).toHaveBeenCalledTimes(1)
  })

  it('confirm force delete calls deleteProject with force=true', async () => {
    projectApi.listProjects
      .mockResolvedValueOnce({ data: [PROJECT] })
      .mockResolvedValueOnce({ data: [] })
    projectApi.deleteProject
      .mockRejectedValueOnce({
        response: { status: 409, data: { message: 'Has tasks', taskCount: 1, subprojectCount: 0 } }
      })
      .mockResolvedValueOnce({})

    setup()
    await waitFor(() => screen.getByTestId('delete-project-btn-1'))
    fireEvent.click(screen.getByTestId('delete-project-btn-1'))
    await waitFor(() => screen.getByTestId('delete-warning-dialog'))

    fireEvent.click(screen.getByTestId('confirm-force-delete-btn'))
    await waitFor(() => expect(projectApi.deleteProject).toHaveBeenCalledWith(1, true))
  })

  // ── NFR-003 Usability: actionable error messages from 400 responses ───────

  it('shows validation error message extracted from data.errors on create 400', async () => {
    projectApi.listProjects.mockResolvedValueOnce({ data: [] })
    projectApi.createProject.mockRejectedValueOnce({
      response: { status: 400, data: { errors: { name: 'Project name is too long' } } }
    })

    setup()
    await waitFor(() => screen.getByTestId('new-project-btn'))
    fireEvent.click(screen.getByTestId('new-project-btn'))
    // Must fill name so the Create button is enabled
    fireEvent.change(screen.getByTestId('project-name-input'), { target: { value: 'Some Name' } })
    fireEvent.click(screen.getByTestId('create-project-btn'))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Project name is too long')
    )
  })

  it('shows validation error extracted from data.errors on update 400', async () => {
    projectApi.listProjects.mockResolvedValueOnce({ data: [PROJECT] })
    projectApi.updateProject.mockRejectedValueOnce({
      response: { status: 400, data: { errors: { name: 'Name cannot be blank' } } }
    })

    setup()
    await waitFor(() => screen.getByTestId('edit-project-btn-1'))
    fireEvent.click(screen.getByTestId('edit-project-btn-1'))
    // The edit form has the existing name pre-filled; save triggers the API call
    fireEvent.click(screen.getByTestId('save-project-edit-btn'))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Name cannot be blank')
    )
  })

  it('add task button is available directly without intermediate step (≤ 2 clicks)', async () => {
    projectApi.listProjects.mockResolvedValueOnce({ data: [] })
    setup()
    // New Project button is visible on page load — 1 click away (no prior step needed)
    await waitFor(() =>
      expect(screen.getByTestId('new-project-btn')).toBeInTheDocument()
    )
  })

  // ── US-022: Shared project badge ──────────────────────────────────────────

  it('renders shared badge for projects with shared=true', async () => {
    projectApi.listProjects.mockResolvedValueOnce({
      data: [{ id: 5, name: 'SharedProject', description: null, subprojects: [], totalSeconds: 0, createdAt: NOW, shared: true }]
    })
    setup()
    await waitFor(() => expect(screen.getByTestId('shared-badge-5')).toBeInTheDocument())
    expect(screen.getByTestId('shared-badge-5')).toHaveTextContent('Shared')
  })

  it('does not render shared badge for projects with shared=false', async () => {
    projectApi.listProjects.mockResolvedValueOnce({
      data: [{ id: 6, name: 'OwnedProject', description: null, subprojects: [], totalSeconds: 0, createdAt: NOW, shared: false }]
    })
    setup()
    await waitFor(() => expect(screen.getByTestId('project-name-6')).toBeInTheDocument())
    expect(screen.queryByTestId('shared-badge-6')).not.toBeInTheDocument()
  })
})
