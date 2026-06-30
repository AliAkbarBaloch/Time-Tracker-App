import { useState, useEffect } from 'react'
import axios from 'axios'

const MOCK_TASKS = [
  { id: 1, description: 'Studying React components', start: '09:00', end: '10:30', duration: '1h 30m', projects: ['AI-Driven Software Dev'] },
  { id: 2, description: 'Reading research paper',    start: '11:00', end: '12:15', duration: '1h 15m', projects: ['Thesis'] },
  { id: 3, description: 'Sprint planning meeting',   start: '14:00', end: '14:45', duration: '45m',    projects: [] },
]

export default function DashboardPage() {
  const [isRunning, setIsRunning] = useState(true)
  const [elapsed, setElapsed]     = useState('01:23:45')
  const [taskDesc, setTaskDesc]   = useState('')
  const [backendStatus, setBackendStatus] = useState('checking…')

  useEffect(() => {
    axios.get('/api/health')
      .then(res => setBackendStatus(res.data.status))
      .catch(() => setBackendStatus('unreachable'))
  }, [])

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Dashboard</h2>
        <span className="backend-badge">Backend: {backendStatus}</span>
      </div>

      {/* Timer Widget */}
      <div className="timer-card">
        <div className="timer-section">
          <input
            className="timer-input"
            type="text"
            placeholder="What are you working on?"
            value={taskDesc}
            onChange={e => setTaskDesc(e.target.value)}
          />
          {isRunning ? (
            <div className="timer-running">
              <span className="timer-display">{elapsed}</span>
              <button className="btn btn-stop" onClick={() => setIsRunning(false)}>■ Stop</button>
            </div>
          ) : (
            <button className="btn btn-primary btn-start" onClick={() => setIsRunning(true)}>▶ Start</button>
          )}
        </div>
        <div className="timer-meta">
          <span>Project: <strong>AI-Driven Software Dev</strong></span>
          <button className="btn btn-ghost btn-sm">+ Add manually</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-row">
        <div className="summary-card">
          <span className="summary-label">Today</span>
          <span className="summary-value">3h 30m</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">This Week</span>
          <span className="summary-value">14h 15m</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">This Month</span>
          <span className="summary-value">62h 40m</span>
        </div>
      </div>

      {/* Today's Tasks */}
      <div className="section">
        <div className="section-header">
          <h3>Today — Monday, 30 Jun 2026</h3>
          <span className="section-total">Total: 3h 30m</span>
        </div>
        <table className="task-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Start</th>
              <th>End</th>
              <th>Duration</th>
              <th>Projects</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_TASKS.map(t => (
              <tr key={t.id}>
                <td>{t.description}</td>
                <td>{t.start}</td>
                <td>{t.end}</td>
                <td><strong>{t.duration}</strong></td>
                <td>
                  {t.projects.map(p => <span key={p} className="tag">{p}</span>)}
                  {t.projects.length === 0 && <span className="muted">—</span>}
                </td>
                <td className="actions">
                  <button className="btn btn-ghost btn-xs">Edit</button>
                  <button className="btn btn-ghost btn-xs danger">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
