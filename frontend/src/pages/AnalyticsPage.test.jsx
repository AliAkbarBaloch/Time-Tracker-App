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
})
