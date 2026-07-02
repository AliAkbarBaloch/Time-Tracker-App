import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { ToastProvider, useToast } from './ToastContext'

// Helper that renders one button per toast type
function Trigger() {
  const toast = useToast()
  return (
    <>
      <button onClick={() => toast.success('Item saved')}>fire-success</button>
      <button onClick={() => toast.error('Request failed')}>fire-error</button>
      <button onClick={() => toast.info('Just a note')}>fire-info</button>
    </>
  )
}

describe('ToastContext', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  // ── Provider basics ───────────────────────────────────────────────────────

  it('renders children without error', () => {
    render(<ToastProvider><p>hello</p></ToastProvider>)
    expect(screen.getByText('hello')).toBeInTheDocument()
  })

  // ── toast.success() ───────────────────────────────────────────────────────

  it('toast.success() renders the message in the DOM', () => {
    render(<ToastProvider><Trigger /></ToastProvider>)
    fireEvent.click(screen.getByText('fire-success'))
    expect(screen.getByText('Item saved')).toBeInTheDocument()
  })

  it('success toast has role="alert"', () => {
    render(<ToastProvider><Trigger /></ToastProvider>)
    fireEvent.click(screen.getByText('fire-success'))
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  // ── toast.error() ─────────────────────────────────────────────────────────

  it('toast.error() renders an error message', () => {
    render(<ToastProvider><Trigger /></ToastProvider>)
    fireEvent.click(screen.getByText('fire-error'))
    expect(screen.getByText('Request failed')).toBeInTheDocument()
  })

  it('error toast has role="alert"', () => {
    render(<ToastProvider><Trigger /></ToastProvider>)
    fireEvent.click(screen.getByText('fire-error'))
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  // ── toast.info() ──────────────────────────────────────────────────────────

  it('toast.info() renders an info message', () => {
    render(<ToastProvider><Trigger /></ToastProvider>)
    fireEvent.click(screen.getByText('fire-info'))
    expect(screen.getByText('Just a note')).toBeInTheDocument()
  })

  // ── Auto-dismiss ──────────────────────────────────────────────────────────

  it('toast is visible before 3 500 ms', () => {
    render(<ToastProvider><Trigger /></ToastProvider>)
    fireEvent.click(screen.getByText('fire-success'))
    act(() => { vi.advanceTimersByTime(2000) })
    expect(screen.getByText('Item saved')).toBeInTheDocument()
  })

  it('toast auto-dismisses after 3 500 ms', () => {
    render(<ToastProvider><Trigger /></ToastProvider>)
    fireEvent.click(screen.getByText('fire-success'))
    expect(screen.getByText('Item saved')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(3500) })
    expect(screen.queryByText('Item saved')).not.toBeInTheDocument()
  })

  // ── Manual dismiss ────────────────────────────────────────────────────────

  it('clicking the Dismiss button removes the toast', () => {
    render(<ToastProvider><Trigger /></ToastProvider>)
    fireEvent.click(screen.getByText('fire-success'))
    expect(screen.getByText('Item saved')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(screen.queryByText('Item saved')).not.toBeInTheDocument()
  })

  it('clicking the toast body also dismisses it', () => {
    render(<ToastProvider><Trigger /></ToastProvider>)
    fireEvent.click(screen.getByText('fire-success'))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('alert'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  // ── Multiple toasts ───────────────────────────────────────────────────────

  it('multiple toasts can coexist in the DOM', () => {
    render(<ToastProvider><Trigger /></ToastProvider>)
    fireEvent.click(screen.getByText('fire-success'))
    fireEvent.click(screen.getByText('fire-error'))
    fireEvent.click(screen.getByText('fire-info'))
    expect(screen.getByText('Item saved')).toBeInTheDocument()
    expect(screen.getByText('Request failed')).toBeInTheDocument()
    expect(screen.getByText('Just a note')).toBeInTheDocument()
  })

  it('dismissing one toast does not remove the others', () => {
    render(<ToastProvider><Trigger /></ToastProvider>)
    fireEvent.click(screen.getByText('fire-success'))
    fireEvent.click(screen.getByText('fire-error'))
    const alerts = screen.getAllByRole('alert')
    fireEvent.click(alerts[0]) // dismiss first
    expect(screen.getByText('Request failed')).toBeInTheDocument()
  })

  it('each toast auto-dismisses independently', () => {
    render(<ToastProvider><Trigger /></ToastProvider>)
    fireEvent.click(screen.getByText('fire-success'))
    act(() => { vi.advanceTimersByTime(1000) })
    fireEvent.click(screen.getByText('fire-error'))
    // advance to dismiss only the first one
    act(() => { vi.advanceTimersByTime(2500) })
    expect(screen.queryByText('Item saved')).not.toBeInTheDocument()
    expect(screen.getByText('Request failed')).toBeInTheDocument()
  })

  // ── useToast fallback (outside provider) ──────────────────────────────────

  it('useToast returns no-op functions when used outside ToastProvider', () => {
    let captured
    function Consumer() { captured = useToast(); return null }
    render(<Consumer />)
    expect(typeof captured.success).toBe('function')
    expect(typeof captured.error).toBe('function')
    expect(typeof captured.info).toBe('function')
    expect(() => captured.success('x')).not.toThrow()
    expect(() => captured.error('x')).not.toThrow()
    expect(() => captured.info('x')).not.toThrow()
  })
})
