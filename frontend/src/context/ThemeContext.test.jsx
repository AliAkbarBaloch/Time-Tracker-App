import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ThemeProvider } from './ThemeContext'
import { useTheme } from './useTheme'

function mockMatchMedia(prefersDark = false) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn(() => ({
      matches: prefersDark,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
}

// Helper that exposes theme state and all setTheme actions
function ThemeConsumer() {
  const { theme, setTheme } = useTheme()
  return (
    <>
      <span data-testid="current-theme">{theme}</span>
      <button onClick={() => setTheme('light')}>set-light</button>
      <button onClick={() => setTheme('dark')}>set-dark</button>
      <button onClick={() => setTheme('system')}>set-system</button>
    </>
  )
}

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    mockMatchMedia(false)
  })

  // ── Default state ─────────────────────────────────────────────────────────

  it('defaults to light theme when localStorage is empty', () => {
    render(<ThemeProvider><ThemeConsumer /></ThemeProvider>)
    expect(screen.getByTestId('current-theme')).toHaveTextContent('light')
  })

  it('applies data-theme="light" to <html> on mount', () => {
    render(<ThemeProvider><ThemeConsumer /></ThemeProvider>)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  // ── localStorage persistence ──────────────────────────────────────────────

  it('reads stored "dark" theme from localStorage on mount', () => {
    localStorage.setItem('tt_theme', 'dark')
    render(<ThemeProvider><ThemeConsumer /></ThemeProvider>)
    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('persists chosen theme to localStorage', () => {
    render(<ThemeProvider><ThemeConsumer /></ThemeProvider>)
    act(() => { screen.getByText('set-dark').click() })
    expect(localStorage.getItem('tt_theme')).toBe('dark')
  })

  // ── Light mode ────────────────────────────────────────────────────────────

  it('setTheme("light") applies data-theme="light"', () => {
    localStorage.setItem('tt_theme', 'dark')
    render(<ThemeProvider><ThemeConsumer /></ThemeProvider>)
    act(() => { screen.getByText('set-light').click() })
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(screen.getByTestId('current-theme')).toHaveTextContent('light')
  })

  // ── Dark mode ─────────────────────────────────────────────────────────────

  it('setTheme("dark") applies data-theme="dark"', () => {
    render(<ThemeProvider><ThemeConsumer /></ThemeProvider>)
    act(() => { screen.getByText('set-dark').click() })
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark')
  })

  // ── System mode ───────────────────────────────────────────────────────────

  it('setTheme("system") keeps state as "system"', () => {
    render(<ThemeProvider><ThemeConsumer /></ThemeProvider>)
    act(() => { screen.getByText('set-system').click() })
    expect(screen.getByTestId('current-theme')).toHaveTextContent('system')
  })

  it('system theme applies data-theme="light" when OS prefers light', () => {
    mockMatchMedia(false)
    render(<ThemeProvider><ThemeConsumer /></ThemeProvider>)
    act(() => { screen.getByText('set-system').click() })
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('system theme applies data-theme="dark" when OS prefers dark', () => {
    mockMatchMedia(true)
    render(<ThemeProvider><ThemeConsumer /></ThemeProvider>)
    act(() => { screen.getByText('set-system').click() })
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('system theme stored in localStorage is read correctly on mount', () => {
    mockMatchMedia(true)
    localStorage.setItem('tt_theme', 'system')
    render(<ThemeProvider><ThemeConsumer /></ThemeProvider>)
    expect(screen.getByTestId('current-theme')).toHaveTextContent('system')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('system mode registers a matchMedia "change" event listener', () => {
    const addListener = vi.fn()
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn(() => ({
        matches: false,
        addEventListener: addListener,
        removeEventListener: vi.fn(),
      })),
    })
    render(<ThemeProvider><ThemeConsumer /></ThemeProvider>)
    act(() => { screen.getByText('set-system').click() })
    expect(addListener).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('switching away from system mode removes the matchMedia listener', () => {
    const removeListener = vi.fn()
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: removeListener,
      })),
    })
    render(<ThemeProvider><ThemeConsumer /></ThemeProvider>)
    act(() => { screen.getByText('set-system').click() })
    act(() => { screen.getByText('set-dark').click() })
    expect(removeListener).toHaveBeenCalledWith('change', expect.any(Function))
  })

  // ── localStorage error resilience ────────────────────────────────────────

  it('falls back to "light" when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('quota') })
    render(<ThemeProvider><ThemeConsumer /></ThemeProvider>)
    expect(screen.getByTestId('current-theme')).toHaveTextContent('light')
    vi.restoreAllMocks()
  })

  it('does not throw when localStorage.setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    render(<ThemeProvider><ThemeConsumer /></ThemeProvider>)
    expect(() => act(() => { screen.getByText('set-dark').click() })).not.toThrow()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    vi.restoreAllMocks()
  })

  // ── Guard ─────────────────────────────────────────────────────────────────

  it('useTheme throws when called outside ThemeProvider', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    function Bad() { useTheme(); return null }
    expect(() => render(<Bad />)).toThrow('useTheme must be used inside ThemeProvider')
    errorSpy.mockRestore()
  })
})
