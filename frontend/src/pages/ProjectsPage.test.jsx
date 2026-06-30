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
})
