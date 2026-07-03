import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AnalyticsPage from './AnalyticsPage'
import { AuthProvider } from '../context/AuthContext'
import { TimerProvider } from '../context/TimerContext'
import * as analyticsApi from '../api/analyticsApi'

vi.mock('../api/analyticsApi')

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

function makeHeatmap(year = 2026, days = []) {
  return { data: { year, days } }
}

function makePattern(avgSeconds = 0) {
  return {
    data: {
      weeks: 12,
      byDayOfWeek: DAYS.map(d => ({ day: d, avgSeconds })),
    },
  }
}

function makeBreakdown(projects = []) {
  return { data: { weeks: 12, projects } }
}

function setup() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <TimerProvider>
          <AnalyticsPage />
        </TimerProvider>
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('AnalyticsPage — US-028', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    analyticsApi.getHeatmap.mockResolvedValue(makeHeatmap())
    analyticsApi.getWeeklyPattern.mockResolvedValue(makePattern())
    analyticsApi.getSharedBreakdown.mockResolvedValue(makeBreakdown())
  })

  it('renders the analytics page', async () => {
    setup()
    await waitFor(() => {
      expect(screen.getByTestId('analytics-page')).toBeInTheDocument()
    })
    expect(screen.getByText('Productivity Analytics')).toBeInTheDocument()
  })

  it('renders the heatmap grid', async () => {
    setup()
    await waitFor(() => {
      expect(screen.getByTestId('heatmap-grid')).toBeInTheDocument()
    })
  })

  it('renders heatmap cells for days with data', async () => {
    analyticsApi.getHeatmap.mockResolvedValue(
      makeHeatmap(2026, [{ date: '2026-03-10', totalSeconds: 7200 }])
    )
    setup()
    await waitFor(() => {
      const cell = screen.getByTestId('heatmap-cell-2026-03-10')
      expect(cell).toBeInTheDocument()
    })
  })

  it('renders the year selector with current year selected', async () => {
    setup()
    await waitFor(() => {
      const select = screen.getByTestId('year-select')
      expect(select).toBeInTheDocument()
    })
    const currentYear = new Date().getFullYear().toString()
    expect(screen.getByTestId('year-select').value).toBe(currentYear)
  })

  it('fetches new heatmap when year is changed', async () => {
    setup()
    await waitFor(() => screen.getByTestId('year-select'))

    analyticsApi.getHeatmap.mockResolvedValue(makeHeatmap(2025))
    const select = screen.getByTestId('year-select')
    fireEvent.change(select, { target: { value: '2025' } })

    await waitFor(() => {
      expect(analyticsApi.getHeatmap).toHaveBeenCalledWith(2025)
    })
  })

  it('re-fetches weekly pattern with the selected year when year changes', async () => {
    setup()
    await waitFor(() => screen.getByTestId('year-select'))

    analyticsApi.getWeeklyPattern.mockResolvedValue(makePattern(1800))
    fireEvent.change(screen.getByTestId('year-select'), { target: { value: '2024' } })

    await waitFor(() => {
      expect(analyticsApi.getWeeklyPattern).toHaveBeenCalledWith(12, 2024)
    })
  })

  it('subtitle shows the selected year in the weekly pattern section', async () => {
    setup()
    await waitFor(() => screen.getByTestId('analytics-page'))
    const currentYear = new Date().getFullYear()
    const matches = screen.getAllByText(new RegExp(`last 12 weeks of ${currentYear}`))
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('renders the weekly pattern chart', async () => {
    setup()
    await waitFor(() => {
      expect(screen.getByTestId('week-pattern-chart')).toBeInTheDocument()
    })
  })

  it('renders 7 day-of-week bars MON through SUN', async () => {
    setup()
    await waitFor(() => {
      for (const day of DAYS) {
        expect(screen.getByTestId(`week-bar-${day}`)).toBeInTheDocument()
      }
    })
  })

  it('shows non-zero bar height when pattern data has values', async () => {
    analyticsApi.getWeeklyPattern.mockResolvedValue(
      makePattern(3600) // 1h average every day
    )
    setup()
    await waitFor(() => {
      // MON bar fill should have 100% height (it's the max)
      const monFill = screen.getByTestId('week-bar-fill-MON')
      expect(monFill.style.height).toBe('100%')
    })
  })

  it('renders heatmap legend', async () => {
    setup()
    await waitFor(() => {
      expect(screen.getByTestId('heatmap-legend')).toBeInTheDocument()
    })
  })

  it('renders correct cell color for high activity day', async () => {
    // Single day with some activity
    analyticsApi.getHeatmap.mockResolvedValue(
      makeHeatmap(2026, [{ date: '2026-06-15', totalSeconds: 28800 }]) // 8h
    )
    setup()
    await waitFor(() => {
      const cell = screen.getByTestId('heatmap-cell-2026-06-15')
      // Cell background should NOT be the empty gray (#ebedf0)
      expect(cell.style.background).not.toBe('transparent')
    })
  })

  it('heatmap cell has tooltip title attribute', async () => {
    analyticsApi.getHeatmap.mockResolvedValue(
      makeHeatmap(2026, [{ date: '2026-01-05', totalSeconds: 3600 }])
    )
    setup()
    await waitFor(() => {
      const cell = screen.getByTestId('heatmap-cell-2026-01-05')
      expect(cell.title).toContain('2026-01-05')
      expect(cell.title).toContain('1h')
    })
  })

  it('heatmap grid renders correct total cell count for current year', async () => {
    setup()
    await waitFor(() => screen.getByTestId('heatmap-grid'))
    // All cells: pad + real days + trailing pad = multiple of 7
    const grid = screen.getByTestId('heatmap-grid')
    const allCells = grid.querySelectorAll('[data-testid]')
    expect(allCells.length % 7).toBe(0)
    // At least 365 real days
    const realCells = grid.querySelectorAll('[data-testid^="heatmap-cell-2"]')
    const currentYear = new Date().getFullYear()
    const isLeap = (currentYear % 4 === 0 && currentYear % 100 !== 0) || currentYear % 400 === 0
    expect(realCells.length).toBe(isLeap ? 366 : 365)
  })

  it('shows empty-state message when heatmap has no days', async () => {
    analyticsApi.getHeatmap.mockResolvedValue(makeHeatmap(2020, []))
    setup()
    await waitFor(() => {
      expect(screen.getByTestId('heatmap-empty')).toBeInTheDocument()
    })
  })

  it('shows error message when heatmap fetch fails', async () => {
    analyticsApi.getHeatmap.mockRejectedValue(new Error('Network error'))
    setup()
    await waitFor(() => {
      expect(screen.getByTestId('heatmap-error')).toBeInTheDocument()
    })
  })

  // ── Shared Breakdown ──────────────────────────────────────────────────────

  it('renders breakdown section', async () => {
    setup()
    await waitFor(() => {
      expect(screen.getByTestId('breakdown-section')).toBeInTheDocument()
    })
  })

  it('shows empty state when no shared projects', async () => {
    analyticsApi.getSharedBreakdown.mockResolvedValue(makeBreakdown([]))
    setup()
    await waitFor(() => {
      expect(screen.getByTestId('breakdown-empty')).toBeInTheDocument()
    })
  })

  it('renders shared project contributions when data is present', async () => {
    analyticsApi.getSharedBreakdown.mockResolvedValue(makeBreakdown([
      {
        projectId: 1,
        projectName: 'Team Alpha',
        contributions: [
          { userName: 'Alice', totalSeconds: 7200, percentage: 66.67 },
          { userName: 'Bob', totalSeconds: 3600, percentage: 33.33 },
        ],
      },
    ]))
    setup()
    await waitFor(() => {
      expect(screen.getByTestId('breakdown-list')).toBeInTheDocument()
      expect(screen.getByText('Team Alpha')).toBeInTheDocument()
      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('Bob')).toBeInTheDocument()
      expect(screen.getByText('66.7%')).toBeInTheDocument()
      expect(screen.getByText('33.3%')).toBeInTheDocument()
    })
  })

  it('re-fetches breakdown when year changes', async () => {
    setup()
    await waitFor(() => screen.getByTestId('year-select'))

    analyticsApi.getSharedBreakdown.mockResolvedValue(makeBreakdown())
    fireEvent.change(screen.getByTestId('year-select'), { target: { value: '2024' } })

    await waitFor(() => {
      expect(analyticsApi.getSharedBreakdown).toHaveBeenCalledWith(12, 2024)
    })
  })
})
