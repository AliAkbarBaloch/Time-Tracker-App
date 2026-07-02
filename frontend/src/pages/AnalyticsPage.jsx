import { useState, useEffect, useCallback } from 'react'
import { getHeatmap, getWeeklyPattern } from '../api/analyticsApi'

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

function formatDuration(totalSeconds) {
  if (!totalSeconds) return '0m'
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function getCellColor(seconds, maxSeconds) {
  if (!seconds || seconds === 0) return '#ebedf0'
  if (!maxSeconds || maxSeconds === 0) return '#9be9a8'
  const ratio = seconds / maxSeconds
  if (ratio < 0.25) return '#9be9a8'
  if (ratio < 0.50) return '#40c463'
  if (ratio < 0.75) return '#30a14e'
  return '#216e39'
}

function buildHeatmapCells(year, dataMap) {
  // Jan 1 of the year, find what Mon-first day-of-week it falls on
  const jan1 = new Date(year, 0, 1)
  const startPad = (jan1.getDay() + 6) % 7 // 0=Mon … 6=Sun

  const cells = []

  // Padding before Jan 1
  for (let i = 0; i < startPad; i++) {
    cells.push({ date: null, totalSeconds: 0, pad: true })
  }

  // Every day of the year
  const cur = new Date(year, 0, 1)
  while (cur.getFullYear() === year) {
    const dateStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
    cells.push({ date: dateStr, totalSeconds: dataMap[dateStr] ?? 0, pad: false })
    cur.setDate(cur.getDate() + 1)
  }

  // Padding after Dec 31 to complete the last week
  while (cells.length % 7 !== 0) {
    cells.push({ date: null, totalSeconds: 0, pad: true })
  }

  return cells
}

export default function AnalyticsPage() {
  const currentYear = new Date().getFullYear()
  const [year, setYear]               = useState(currentYear)
  const [heatmapData, setHeatmapData] = useState(null)
  const [patternData, setPatternData] = useState(null)
  const [loading, setLoading]         = useState(false)
  const [tooltip, setTooltip]         = useState(null) // { date, totalSeconds, x, y }

  const fetchHeatmap = useCallback((y) => {
    setLoading(true)
    getHeatmap(y)
      .then(res => setHeatmapData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const fetchPattern = useCallback(() => {
    getWeeklyPattern(12)
      .then(res => setPatternData(res.data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchHeatmap(year)
    fetchPattern()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleYearChange = (e) => {
    const y = parseInt(e.target.value, 10)
    setYear(y)
    fetchHeatmap(y)
  }

  // Build heatmap cells
  const dataMap = {}
  if (heatmapData) {
    for (const { date, totalSeconds } of heatmapData.days) {
      dataMap[date] = totalSeconds
    }
  }
  const cells = buildHeatmapCells(year, dataMap)
  const maxSeconds = Math.max(...cells.filter(c => !c.pad).map(c => c.totalSeconds), 0)
  const totalWeeks = cells.length / 7

  // Build week pattern bars
  const pattern = patternData?.byDayOfWeek ?? DAYS.map(d => ({ day: d, avgSeconds: 0 }))
  const maxAvg = Math.max(...pattern.map(d => d.avgSeconds), 1)

  // Year options: current year +5 / -10 so users can browse history and near future
  const yearOptions = []
  for (let y = currentYear + 5; y >= currentYear - 10; y--) {
    yearOptions.push(y)
  }

  return (
    <div className="page" data-testid="analytics-page">
      <div className="page-header">
        <h2 className="page-title">Productivity Analytics</h2>
        <select className="timer-input" style={{ width: 'auto' }}
          value={year} onChange={handleYearChange} data-testid="year-select">
          {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* ── Activity Heatmap ─────────────────────────────────────────────────── */}
      <section className="analytics-section">
        <h3 className="section-title">Activity Heatmap — {year}</h3>
        {loading ? (
          <p className="empty-state" data-testid="heatmap-loading">Loading…</p>
        ) : (
          <div className="heatmap-wrap">
            {/* Day labels on the left */}
            <div className="heatmap-day-labels">
              {DAYS.map(d => (
                <span key={d} className="heatmap-day-label">{d.slice(0, 1)}</span>
              ))}
            </div>
            {/* Grid: rows = days of week, columns = weeks */}
            <div
              className="heatmap-grid"
              data-testid="heatmap-grid"
              style={{
                display: 'grid',
                gridTemplateRows: 'repeat(7, 14px)',
                gridAutoFlow: 'column',
                gridAutoColumns: '14px',
                gap: '2px',
                cursor: 'pointer',
              }}
              onMouseLeave={() => setTooltip(null)}
            >
              {cells.map((cell, idx) => (
                <div
                  key={idx}
                  data-testid={cell.pad ? 'heatmap-cell-pad' : `heatmap-cell-${cell.date}`}
                  style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '2px',
                    background: cell.pad ? 'transparent' : getCellColor(cell.totalSeconds, maxSeconds),
                  }}
                  title={cell.pad ? '' : `${cell.date}: ${formatDuration(cell.totalSeconds)}`}
                  onMouseEnter={cell.pad ? undefined : (e) => {
                    const rect = e.target.getBoundingClientRect()
                    setTooltip({ date: cell.date, totalSeconds: cell.totalSeconds, x: rect.left, y: rect.top })
                  }}
                />
              ))}
            </div>
            {/* Tooltip */}
            {tooltip && (
              <div className="heatmap-tooltip" data-testid="heatmap-tooltip"
                style={{ position: 'fixed', left: tooltip.x, top: tooltip.y - 36,
                  background: '#333', color: '#fff', padding: '4px 8px',
                  borderRadius: '4px', fontSize: '12px', pointerEvents: 'none', zIndex: 100 }}>
                {tooltip.date}: {formatDuration(tooltip.totalSeconds)}
              </div>
            )}
            {/* Legend */}
            <div className="heatmap-legend" data-testid="heatmap-legend">
              <span className="legend-label">Less</span>
              {['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'].map(c => (
                <span key={c} style={{ width: '12px', height: '12px', background: c,
                  display: 'inline-block', borderRadius: '2px', margin: '0 1px' }} />
              ))}
              <span className="legend-label">More</span>
            </div>
          </div>
        )}
      </section>

      {/* ── Day-of-Week Pattern ──────────────────────────────────────────────── */}
      <section className="analytics-section">
        <h3 className="section-title">Average Hours by Day of Week <span style={{ fontWeight: 'normal', fontSize: '0.85em', color: '#666' }}>(avg per weekday, last 12 weeks)</span></h3>
        <div className="week-pattern-chart" data-testid="week-pattern-chart">
          {pattern.map(({ day, avgSeconds }) => {
            const pct = maxAvg > 0 ? (avgSeconds / maxAvg) * 100 : 0
            return (
              <div key={day} className="week-bar-col" data-testid={`week-bar-${day}`}>
                <div className="week-bar-track">
                  <div
                    className="week-bar-fill"
                    data-testid={`week-bar-fill-${day}`}
                    style={{ height: `${Math.max(pct, 0)}%`, background: '#40c463' }}
                    title={`${day}: avg ${formatDuration(avgSeconds)}`}
                  />
                </div>
                <span className="week-bar-label">{day}</span>
                <span className="week-bar-value" data-testid={`week-bar-value-${day}`}>
                  {formatDuration(avgSeconds)}
                </span>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
