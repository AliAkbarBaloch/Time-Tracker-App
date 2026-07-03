import { render, screen, fireEvent } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import ErrorBoundary from './ErrorBoundary'

const ThrowOnMount = ({ shouldThrow }) => {
  if (shouldThrow) throw new Error('Boom')
  return <div>safe content</div>
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>normal content</div>
      </ErrorBoundary>
    )
    expect(screen.getByText('normal content')).toBeDefined()
  })

  test('renders fallback UI when a child throws during render', () => {
    render(
      <ErrorBoundary>
        <ThrowOnMount shouldThrow />
      </ErrorBoundary>
    )
    expect(screen.getByText(/something went wrong/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /try again/i })).toBeDefined()
  })

  test('fallback UI does not show the crashed child content', () => {
    render(
      <ErrorBoundary>
        <ThrowOnMount shouldThrow />
      </ErrorBoundary>
    )
    expect(screen.queryByText('safe content')).toBeNull()
  })

  test('try-again button resets error state so children can render', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowOnMount shouldThrow />
      </ErrorBoundary>
    )
    // Boundary caught the error
    expect(screen.getByText(/something went wrong/i)).toBeDefined()

    // Replace the throwing child with a safe one BEFORE clicking Try again.
    // If we clicked first, React would immediately re-render with the still-throwing
    // child, catch again, and set hasError back to true before we could swap children.
    rerender(
      <ErrorBoundary>
        <ThrowOnMount shouldThrow={false} />
      </ErrorBoundary>
    )
    // hasError is still true so the fallback is still shown; click to reset
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(screen.getByText('safe content')).toBeDefined()
  })

  test('componentDidCatch logs the error', () => {
    render(
      <ErrorBoundary>
        <ThrowOnMount shouldThrow />
      </ErrorBoundary>
    )
    expect(console.error).toHaveBeenCalled()
  })

  test('sibling boundaries are independent — one crash does not affect the other', () => {
    render(
      <div>
        <ErrorBoundary>
          <ThrowOnMount shouldThrow />
        </ErrorBoundary>
        <ErrorBoundary>
          <div>sibling still alive</div>
        </ErrorBoundary>
      </div>
    )
    expect(screen.getByText(/something went wrong/i)).toBeDefined()
    expect(screen.getByText('sibling still alive')).toBeDefined()
  })
})
