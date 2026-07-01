import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import * as taskApi from '../api/taskApi'

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function formatSeconds(totalSecs) {
  if (!totalSecs) return '—'
  const h = Math.floor(totalSecs / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

function getLocalDateStr(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─── Week helpers ───────────────────────────────────────────────────────────

function getWeekDays(offset) {
  const now = new Date()
  const dow = now.getDay()
  const mondayDiff = dow === 0 ? -6 : 1 - dow
  return Array.from({ length: 7 }, (_, i) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayDiff + offset * 7 + i)
  )
}

function weekApiRange(weekDays) {
  const monday = weekDays[0]
  const from = monday.toISOString()
  const to = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7).toISOString()
  return { from, to }
}

function buildWeekData(weekDays, tasks) {
  return weekDays.map(date => {
    const ds = getLocalDateStr(date.toISOString())
    const dayTasks = tasks.filter(t => getLocalDateStr(t.startTime) === ds)
    const totalSecs = dayTasks.reduce((sum, t) => {
      if (!t.endTime) return sum
      return sum + Math.floor((new Date(t.endTime) - new Date(t.startTime)) / 1000)
    }, 0)
    return { date, tasks: dayTasks, totalSecs }
  })
}

function formatWeekLabel(weekDays) {
  const fmt = d => `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`
  return `${fmt(weekDays[0])} – ${fmt(weekDays[6])}, ${weekDays[0].getFullYear()}`
}

function formatTaskDuration(startTime, endTime) {
  if (!endTime) return '(running)'
  const secs = Math.floor((new Date(endTime) - new Date(startTime)) / 1000)
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(s).padStart(2, '0')}s`
}

// ─── Month helpers ──────────────────────────────────────────────────────────

function getMonthInfo(offset) {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  return {
    year: first.getFullYear(),
    month: first.getMonth(),
    firstDay: first,
    lastDay: new Date(first.getFullYear(), first.getMonth() + 1, 0),
  }
}

function getCalendarCells(offset) {
  const { year, month, firstDay, lastDay } = getMonthInfo(offset)
  const firstDow = (firstDay.getDay() + 6) % 7  // Mon = 0
  const lastDow  = (lastDay.getDay()  + 6) % 7
  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(year, month, d))
  const trailing = lastDow === 6 ? 0 : 6 - lastDow
  for (let i = 0; i < trailing; i++) cells.push(null)
  return cells
}

function monthApiRange(offset) {
  const { firstDay, year, month } = getMonthInfo(offset)
  return {
    from: firstDay.toISOString(),
    to:   new Date(year, month + 1, 1).toISOString(),
  }
}

function formatMonthLabel(offset) {
  const { firstDay } = getMonthInfo(offset)
  return firstDay.toLocaleString('default', { month: 'long', year: 'numeric' })
}

function buildDayDataMap(tasks) {
  const map = {}
  for (const t of tasks) {
    const ds = getLocalDateStr(t.startTime)
    if (!map[ds]) map[ds] = { tasks: [], totalSecs: 0 }
    map[ds].tasks.push(t)
    if (t.endTime) {
      map[ds].totalSecs += Math.floor((new Date(t.endTime) - new Date(t.startTime)) / 1000)
    }
  }
  return map
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const navigate = useNavigate()
  const [view, setView]               = useState('week')
  const [weekOffset, setWeekOffset]   = useState(0)
  const [monthOffset, setMonthOffset] = useState(0)
  const [tasks, setTasks]             = useState([])
  const [loading, setLoading]         = useState(false)
  const [selectedDay, setSelectedDay] = useState(null)

  // Week derived
  const weekDays      = getWeekDays(weekOffset)
  const weekData      = buildWeekData(weekDays, tasks)
  const weekTotalSecs = weekData.reduce((sum, d) => sum + d.totalSecs, 0)

  // Month derived
  const calendarCells  = getCalendarCells(monthOffset)
  const dayDataMap     = buildDayDataMap(tasks)
  const monthTotalSecs = Object.values(dayDataMap).reduce((sum, d) => sum + d.totalSecs, 0)
  const selectedDayTasks = selectedDay ? (dayDataMap[selectedDay]?.tasks ?? []) : []

  const fetchWeekTasks = useCallback(() => {
    const days = getWeekDays(weekOffset)
    const { from, to } = weekApiRange(days)
    setLoading(true)
    taskApi.listTasks(from, to)
      .then(res => setTasks(res.data))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false))
  }, [weekOffset])

  const fetchMonthTasks = useCallback(() => {
    const { from, to } = monthApiRange(monthOffset)
    setLoading(true)
    taskApi.listTasks(from, to)
      .then(res => setTasks(res.data))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false))
  }, [monthOffset])

  useEffect(() => {
    if (view === 'week') fetchWeekTasks()
  }, [view, fetchWeekTasks])

  useEffect(() => {
    if (view === 'month') fetchMonthTasks()
  }, [view, fetchMonthTasks])

  useEffect(() => {
    setSelectedDay(null)
  }, [monthOffset])

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Overview</h2>
        <div className="view-toggle">
          {['week', 'month'].map(v => (
            <button key={v}
              className={`btn btn-ghost btn-sm ${view === v ? 'active' : ''}`}
              onClick={() => setView(v)}
              data-testid={`view-tab-${v}`}
            >{v === 'week' ? 'Week' : 'Month'}</button>
          ))}
        </div>

        {view === 'week' && (
          <div className="nav-arrows">
            <button className="btn btn-ghost btn-sm"
              onClick={() => setWeekOffset(o => o - 1)}
              data-testid="prev-week-btn">‹ Prev</button>
            <span className="nav-label" data-testid="week-label">
              {formatWeekLabel(weekDays)}
            </span>
            <button className="btn btn-ghost btn-sm"
              onClick={() => setWeekOffset(o => o + 1)}
              data-testid="next-week-btn">Next ›</button>
          </div>
        )}

        {view === 'month' && (
          <div className="nav-arrows">
            <button className="btn btn-ghost btn-sm"
              onClick={() => setMonthOffset(o => o - 1)}
              data-testid="prev-month-btn">‹ Prev</button>
            <span className="nav-label" data-testid="month-label">
              {formatMonthLabel(monthOffset)}
            </span>
            <button className="btn btn-ghost btn-sm"
              onClick={() => setMonthOffset(o => o + 1)}
              data-testid="next-month-btn">Next ›</button>
          </div>
        )}
      </div>

      {/* ── Week view ── */}
      {view === 'week' && (
        <>
          {loading && <p className="empty-state" data-testid="week-loading">Loading…</p>}
          <div className="week-grid" data-testid="week-view">
            {weekData.map(({ date, tasks: dayTasks, totalSecs }, i) => (
              <div key={i}
                className={`week-col${totalSecs === 0 ? ' empty' : ''}`}
                data-testid={`week-col-${i}`}>
                <div className="week-day-name">{DAY_NAMES[i]}</div>
                <div className="week-date">
                  {date.getDate()} {date.toLocaleString('default', { month: 'short' })}
                </div>
                <div className="week-total" data-testid={`day-total-${i}`}>
                  {formatSeconds(totalSecs)}
                </div>
                {dayTasks.length > 0 && (
                  <ul className="week-tasks" data-testid={`day-tasks-${i}`}>
                    {dayTasks.map(t => (
                      <li key={t.id}
                        className="week-task-item"
                        data-testid={`week-task-${t.id}`}
                        onClick={() => navigate('/tasks')}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => e.key === 'Enter' && navigate('/tasks')}
                      >
                        <span className="week-task-desc">{t.description || '(no description)'}</span>
                        <span className="week-task-dur">
                          {formatTaskDuration(t.startTime, t.endTime)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          <div className="section" style={{ marginTop: '1.5rem' }}>
            <div className="section-header">
              <h3>Week Total</h3>
              <span className="section-total" data-testid="week-total">
                {formatSeconds(weekTotalSecs)}
              </span>
            </div>
          </div>
        </>
      )}

      {/* ── Month view ── */}
      {view === 'month' && (
        <>
          {loading && <p className="empty-state" data-testid="month-loading">Loading…</p>}

          <div className="section">
            <div className="section-header">
              <h3>Month Total</h3>
              <span className="section-total" data-testid="month-total">
                {formatSeconds(monthTotalSecs)}
              </span>
            </div>
          </div>

          <div className="month-grid" data-testid="month-view">
            {DAY_NAMES.map(n => (
              <div key={n} className="month-header-cell">{n}</div>
            ))}
            {calendarCells.map((date, i) => {
              if (!date) {
                return <div key={`empty-${i}`} className="month-cell month-cell--empty" data-testid={`month-empty-${i}`} />
              }
              const ds = getLocalDateStr(date.toISOString())
              const dayData = dayDataMap[ds]
              const isSelected = selectedDay === ds
              return (
                <div key={ds}
                  className={`month-cell${isSelected ? ' month-cell--selected' : ''}${dayData ? ' month-cell--has-tasks' : ' month-cell--no-tasks'}`}
                  data-testid={`month-day-${ds}`}
                  onClick={() => setSelectedDay(isSelected ? null : ds)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && setSelectedDay(isSelected ? null : ds)}
                >
                  <span className="month-day-num">{date.getDate()}</span>
                  <span className="month-cell-time" data-testid={`month-day-total-${ds}`}>
                    {dayData ? formatSeconds(dayData.totalSecs) : '—'}
                  </span>
                </div>
              )
            })}
          </div>

          {selectedDay && (
            <div className="selected-day-panel" data-testid="selected-day-panel">
              <h4 className="selected-day-title" data-testid="selected-day-title">
                {new Date(selectedDay + 'T12:00:00').toLocaleDateString('default', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                })}
              </h4>
              {selectedDayTasks.length === 0 ? (
                <p className="empty-state" data-testid="selected-day-empty">No tasks this day.</p>
              ) : (
                <ul className="selected-day-tasks" data-testid="selected-day-tasks">
                  {selectedDayTasks.map(t => (
                    <li key={t.id}
                      className="week-task-item"
                      data-testid={`selected-day-task-${t.id}`}
                      onClick={() => navigate('/tasks')}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => e.key === 'Enter' && navigate('/tasks')}
                    >
                      <span className="week-task-desc">{t.description || '(no description)'}</span>
                      <span className="week-task-dur">{formatTaskDuration(t.startTime, t.endTime)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
