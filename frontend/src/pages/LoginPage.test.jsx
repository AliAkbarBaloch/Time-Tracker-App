import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import LoginPage from './LoginPage'

describe('LoginPage', () => {
  it('renders the TimeTracker brand name', () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>)
    expect(screen.getByText('TimeTracker')).toBeInTheDocument()
  })

  it('shows email and password fields', () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('shows Log In and Register tabs', () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>)
    const tabButtons = screen.getAllByRole('button', { name: 'Log In' })
    expect(tabButtons.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('button', { name: 'Register' })).toBeInTheDocument()
  })
})
