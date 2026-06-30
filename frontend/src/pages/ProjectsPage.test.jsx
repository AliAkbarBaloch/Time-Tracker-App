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
        { id: 1, name: 'Thesis', description: 'My thesis', createdAt: new Date().toISOString() },
        { id: 2, name: 'Work', description: null, createdAt: new Date().toISOString() }
      ]
    })
    setup()
    await waitFor(() => {
      expect(screen.getByText('Thesis')).toBeInTheDocument()
      expect(screen.getByText('Work')).toBeInTheDocument()
    })
  })

  it('shows create form when New Project button clicked', async () => {
    projectApi.listProjects.mockResolvedValueOnce({ data: [] })
    setup()
    await waitFor(() => screen.getByTestId('new-project-btn'))
    fireEvent.click(screen.getByTestId('new-project-btn'))
    expect(screen.getByTestId('project-form')).toBeInTheDocument()
    expect(screen.getByTestId('project-name-input')).toBeInTheDocument()
  })

  it('calls createProject and refreshes list on submit', async () => {
    projectApi.listProjects
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [{ id: 1, name: 'NewProject', description: null, createdAt: new Date().toISOString() }] })
    projectApi.createProject.mockResolvedValueOnce({ data: { id: 1, name: 'NewProject' } })

    setup()
    await waitFor(() => screen.getByTestId('new-project-btn'))
    fireEvent.click(screen.getByTestId('new-project-btn'))

    fireEvent.change(screen.getByTestId('project-name-input'), { target: { value: 'NewProject' } })
    fireEvent.click(screen.getByTestId('create-project-btn'))

    await waitFor(() => expect(projectApi.createProject).toHaveBeenCalledWith('NewProject', null))
    await waitFor(() => expect(screen.getByText('NewProject')).toBeInTheDocument())
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
      .mockResolvedValueOnce({ data: [{ id: 1, name: 'Done', description: null, createdAt: new Date().toISOString() }] })
    projectApi.createProject.mockResolvedValueOnce({ data: { id: 1, name: 'Done' } })

    setup()
    await waitFor(() => screen.getByTestId('new-project-btn'))
    fireEvent.click(screen.getByTestId('new-project-btn'))
    fireEvent.change(screen.getByTestId('project-name-input'), { target: { value: 'Done' } })
    fireEvent.click(screen.getByTestId('create-project-btn'))

    await waitFor(() => expect(screen.queryByTestId('project-form')).not.toBeInTheDocument())
  })
})
