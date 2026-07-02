import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import * as taskApi from '../api/taskApi'
import { useAuth } from '../context/AuthContext'
import { getDateStrInTz, todayInTz, localDateToUtcIso } from '../utils/dateUtils'

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatSeconds(totalSecs) {
  if (!totalSecs) return '—'
  const h = Math.floor(totalSecs / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

// ─── Week helpers ───────────────────────────────────────────────────────────

/**
 * Return 7 Date objects (UTC midnight) representing Mon–Sun of the given
 * week offset, anchored to "today" in the user's timezone.
 * Dates are stored as UTC midnight so getUTC* methods give the correct calendar day.
 */
function getWeekDays(offset, tz) {
  const { year, month, day } = todayInTz(tz)
  const todayUtc = new Date(Date.UTC(year, month - 1, day))
  const dow = todayUtc.getUTCDay() // 0=Sun
  const mondayDiff = dow === 0 ? -6 : 1 - dow
  return Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(year, month - 1, day + mondayDiff + offset * 7 + i))
  )
}

function weekApiRange(weekDays, tz) {
  const mon = weekDays[0]
  const sun = weekDays[6]
  const nextMon = new Date(Date.UTC(sun.getUTCFullYear(), sun.getUTCMonth(), sun.getUTCDate() + 1))
  return {
    from: localDateToUtcIso(mon.getUTCFullYear(), mon.getUTCMonth() + 1, mon.getUTCDate(), 0, 0, 0, tz),
    to:   localDateToUtcIso(nextMon.getUTCFullYear(), nextMon.getUTCMonth() + 1, nextMon.getUTCDate(), 0, 0, 0, tz),
  }
}

function buildWeekData(weekDays, tasks, tz) {
  return weekDays.map(date => {
    const y = date.getUTCFullYear()
    const m = String(date.getUTCMonth() + 1).padStart(2, '0')
    const d = String(date.getUTCDate()).padStart(2, '0')
    const ds = `${y}-${m}-${d}`
    const dayTasks = tasks.filter(t => getDateStrInTz(t.startTime, tz) === ds)
    const totalSecs = dayTasks.reduce((sum, t) => {
      if (!t.endTime) return sum
      return sum + Math.floor((new Date(t.endTime) - new Date(t.startTime)) / 1000)
    }, 0)
    return { date, ds, tasks: dayTasks, totalSecs }
  })
}

function formatWeekLabel(weekDays) {
  const fmt = d => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
  return `${fmt(weekDays[0])} – ${fmt(weekDays[6])}, ${weekDays[0].getUTCFullYear()}`
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

/**
 * Return metadata about the month at the given offset relative to today
 * in the user's timezone.  Dates are UTC midnight values.
 */
function getMonthInfo(offset, tz) {
  const { year: ty, month: tm } = todayInTz(tz)
  // tm is 1-indexed; Date.UTC(ty, tm - 1 + offset, 1) handles over/underflow
  const firstDay = new Date(Date.UTC(ty, tm - 1 + offset, 1))
  const lastDay  = new Date(Date.UTC(firstDay.getUTCFullYear(), firstDay.getUTCMonth() + 1, 0))
  return {
    year:     firstDay.getUTCFullYear(),
    month:    firstDay.getUTCMonth(), // 0-indexed (for internal Date.UTC usage)
    firstDay,
    lastDay,
  }
}

function getCalendarCells(offset, tz) {
  const { year, month, firstDay, lastDay } = getMonthInfo(offset, tz)
  const firstDow = (firstDay.getUTCDay() + 6) % 7  // Mon = 0
  const lastDow  = (lastDay.getUTCDay()  + 6) % 7
  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  const numDays = lastDay.getUTCDate()
  for (let d = 1; d <= numDays; d++) cells.push(new Date(Date.UTC(year, month, d)))
  const trailing = lastDow === 6 ? 0 : 6 - lastDow
  for (let i = 0; i < trailing; i++) cells.push(null)
  return cells
}

function monthApiRange(offset, tz) {
  const { firstDay } = getMonthInfo(offset, tz)
  const y  = firstDay.getUTCFullYear()
  const m1 = firstDay.getUTCMonth() + 1 // 1-indexed
  // Next month's first day (Date.UTC handles Dec→Jan overflow)
  const nextFirst = new Date(Date.UTC(y, firstDay.getUTCMonth() + 1, 1))
  const y2 = nextFirst.getUTCFullYear()
  const m2 = nextFirst.getUTCMonth() + 1
  return {
    from: localDateToUtcIso(y, m1, 1, 0, 0, 0, tz),
    to:   localDateToUtcIso(y2, m2, 1, 0, 0, 0, tz),
  }
}

function formatMonthLabel(offset, tz) {
  const { firstDay } = getMonthInfo(offset, tz)
  return firstDay.toLocaleDateString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function buildDayDataMap(tasks, tz) {
  const map = {}
  for (const t of tasks) {
    const ds = getDateStrInTz(t.startTime, tz)
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
  const { user } = useAuth()
  const tz = user?.timezone ?? 'UTC'

  const [view, setView]               = useState('week')
  const [weekOffset, setWeekOffset]   = useState(0)
  const [monthOffset, setMonthOffset] = useState(0)
  const [tasks, setTasks]             = useState([])
  const [loading, setLoading]         = useState(false)

  // Week derived
  const weekDays      = getWeekDays(weekOffset, tz)
  const weekData      = buildWeekData(weekDays, tasks, tz)
  const weekTotalSecs = weekData.reduce((sum, d) => sum + d.totalSecs, 0)

  // Month derived
  const calendarCells  = getCalendarCells(monthOffset, tz)
  const dayDataMap     = buildDayDataMap(tasks, tz)
  const monthTotalSecs = Object.values(dayDataMap).reduce((sum, d) => sum + d.totalSecs, 0)

  const fetchWeekTasks = useCallback(() => {
    const days = getWeekDays(weekOffset, tz)
    const { from, to } = weekApiRange(days, tz)
    setLoading(true)
    taskApi.listTasks(from, to)
      .then(res => setTasks(res.data))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false))
  }, [weekOffset, tz])

  const fetchMonthTasks = useCallback(() => {
    const { from, to } = monthApiRange(monthOffset, tz)
    setLoading(true)
    taskApi.listTasks(from, to)
      .then(res => setTasks(res.data))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false))
  }, [monthOffset, tz])

  useEffect(() => {
    if (view === 'week') fetchWeekTasks()
  }, [view, fetchWeekTasks])

  useEffect(() => {
    if (view === 'month') fetchMonthTasks()
  }, [view, fetchMonthTasks])


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
              {formatMonthLabel(monthOffset, tz)}
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
            {weekData.map(({ date, ds, tasks: dayTasks, totalSecs }, i) => (
              <div key={i}
                className={`week-col${totalSecs === 0 ? ' empty' : ''}`}
                data-testid={`week-col-${i}`}>
                <div
                  className="week-day-header"
                  data-testid={`week-day-header-${i}`}
                  onClick={() => navigate(`/tasks?from=${ds}&to=${ds}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && navigate(`/tasks?from=${ds}&to=${ds}`)}
                >
                  <div className="week-day-name">{DAY_NAMES[i]}</div>
                  <div className="week-date">
                    {date.getUTCDate()} {MONTHS[date.getUTCMonth()]}
                  </div>
                  <div className="week-total" data-testid={`day-total-${i}`}>
                    {formatSeconds(totalSecs)}
                  </div>
                </div>
                {dayTasks.length > 0 && (
                  <ul className="week-tasks" data-testid={`day-tasks-${i}`}>
                    {dayTasks.map(t => (
                      <li key={t.id}
                        className="week-task-item"
                        data-testid={`week-task-${t.id}`}
                        onClick={() => navigate(`/tasks?from=${ds}&to=${ds}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => e.key === 'Enter' && navigate(`/tasks?from=${ds}&to=${ds}`)}
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
              const y  = date.getUTCFullYear()
              const m  = String(date.getUTCMonth() + 1).padStart(2, '0')
              const d  = String(date.getUTCDate()).padStart(2, '0')
              const ds = `${y}-${m}-${d}`
              const dayData = dayDataMap[ds]
              return (
                <div key={ds}
                  className={`month-cell${dayData ? ' month-cell--has-tasks' : ' month-cell--no-tasks'}`}
                  data-testid={`month-day-${ds}`}
                  onClick={() => navigate(`/tasks?from=${ds}&to=${ds}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && navigate(`/tasks?from=${ds}&to=${ds}`)}
                >
                  <span className="month-day-num">{date.getUTCDate()}</span>
                  <span className="month-cell-time" data-testid={`month-day-total-${ds}`}>
                    {dayData ? formatSeconds(dayData.totalSecs) : '—'}
                  </span>
                </div>
              )
            })}
          </div>

        </>
      )}
    </div>
  )
}
