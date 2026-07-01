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

export default function OverviewPage() {
  const navigate = useNavigate()
  const [view, setView]             = useState('week')
  const [weekOffset, setWeekOffset] = useState(0)
  const [tasks, setTasks]           = useState([])
  const [loading, setLoading]       = useState(false)

  const weekDays      = getWeekDays(weekOffset)
  const weekData      = buildWeekData(weekDays, tasks)
  const weekTotalSecs = weekData.reduce((sum, d) => sum + d.totalSecs, 0)

  const fetchWeekTasks = useCallback(() => {
    const days = getWeekDays(weekOffset)
    const { from, to } = weekApiRange(days)
    setLoading(true)
    taskApi.listTasks(from, to)
      .then(res => setTasks(res.data))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false))
  }, [weekOffset])

  useEffect(() => {
    if (view === 'week') fetchWeekTasks()
  }, [view, fetchWeekTasks])

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
      </div>

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

      {view === 'month' && (
        <p className="empty-state" data-testid="month-placeholder">
          Monthly view — coming in the next update.
        </p>
      )}
    </div>
  )
}
