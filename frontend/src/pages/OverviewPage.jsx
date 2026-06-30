import { useState } from 'react'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEK_DATA = [
  { day: 'Mon', date: '23 Jun', total: '4h 30m', tasks: ['Studying React — 1h 30m', 'Reading paper — 3h'] },
  { day: 'Tue', date: '24 Jun', total: '2h 15m', tasks: ['Experiments — 2h 15m'] },
  { day: 'Wed', date: '25 Jun', total: '6h 00m', tasks: ['Final Project — 4h', 'Literature Review — 2h'] },
  { day: 'Thu', date: '26 Jun', total: '3h 45m', tasks: ['Weekly Assignment — 3h 45m'] },
  { day: 'Fri', date: '27 Jun', total: '1h 30m', tasks: ['Sprint planning — 30m', 'Part-time Job — 1h'] },
  { day: 'Sat', date: '28 Jun', total: '',        tasks: [] },
  { day: 'Sun', date: '29 Jun', total: '2h 00m', tasks: ['Reading paper — 2h'] },
]

const MONTH_GRID = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  total: [0, 0, 2.5, 4, 3, 0, 0, 5, 2, 3.5, 4, 1, 0, 0, 4.5, 3, 2, 6, 3.75, 1.5, 0, 0, 4, 2.25, 0, 6, 3, 1, 0, 2][i] || 0,
}))

function heatColor(hours) {
  if (!hours) return '#f3f4f6'
  if (hours < 2) return '#dbeafe'
  if (hours < 4) return '#93c5fd'
  if (hours < 6) return '#3b82f6'
  return '#1d4ed8'
}

export default function OverviewPage() {
  const [view, setView]           = useState('week')
  const [expandedDay, setExpanded] = useState(null)

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Overview</h2>
        <div className="view-toggle">
          {['week', 'month'].map(v => (
            <button
              key={v}
              className={`btn btn-ghost btn-sm ${view === v ? 'active' : ''}`}
              onClick={() => setView(v)}
            >{v === 'week' ? 'Week' : 'Month'}</button>
          ))}
        </div>
        <div className="nav-arrows">
          <button className="btn btn-ghost btn-sm">‹ Prev</button>
          <span className="nav-label">{view === 'week' ? 'Jun 23 – Jun 29, 2026' : 'June 2026'}</span>
          <button className="btn btn-ghost btn-sm">Next ›</button>
        </div>
      </div>

      {view === 'week' && (
        <div className="week-grid">
          {WEEK_DATA.map(d => (
            <div
              key={d.day}
              className={`week-col ${d.total ? '' : 'empty'}`}
              onClick={() => setExpanded(expandedDay === d.day ? null : d.day)}
            >
              <div className="week-day-name">{d.day}</div>
              <div className="week-date">{d.date}</div>
              <div className="week-total">{d.total || '—'}</div>
              {expandedDay === d.day && d.tasks.length > 0 && (
                <ul className="week-tasks">
                  {d.tasks.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {view === 'month' && (
        <>
          <div className="month-grid">
            {DAYS.map(d => <div key={d} className="month-header-cell">{d}</div>)}
            {/* offset for June starting on Monday */}
            {MONTH_GRID.map(({ day, total }) => (
              <div
                key={day}
                className="month-cell"
                style={{ background: heatColor(total) }}
              >
                <span className="month-day-num">{day}</span>
                {total > 0 && <span className="month-cell-time">{total}h</span>}
              </div>
            ))}
          </div>
          <div className="legend">
            <span>Less</span>
            {['#f3f4f6','#dbeafe','#93c5fd','#3b82f6','#1d4ed8'].map(c => (
              <span key={c} className="legend-dot" style={{ background: c }} />
            ))}
            <span>More</span>
          </div>
        </>
      )}

      {/* Weekly total bar */}
      <div className="section" style={{ marginTop: '1.5rem' }}>
        <div className="section-header">
          <h3>Week Total</h3>
          <span className="section-total">20h 00m</span>
        </div>
        <div className="bar-chart">
          {WEEK_DATA.map(d => {
            const h = parseFloat(d.total) || 0
            return (
              <div key={d.day} className="bar-col">
                <div className="bar" style={{ height: `${(h / 6) * 100}%` }} />
                <span className="bar-label">{d.day}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
