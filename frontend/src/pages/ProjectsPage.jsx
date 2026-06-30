import { useState } from 'react'

const MOCK_PROJECTS = [
  {
    id: 1, name: 'AI-Driven Software Dev', totalTime: '28h 15m', color: '#4f46e5',
    subprojects: [
      { id: 11, name: 'Weekly Assignments', totalTime: '12h 00m' },
      { id: 12, name: 'Final Project',      totalTime: '16h 15m' },
    ],
  },
  {
    id: 2, name: 'Thesis', totalTime: '21h 30m', color: '#0891b2',
    subprojects: [
      { id: 21, name: 'Literature Review', totalTime: '9h 00m' },
      { id: 22, name: 'Experiments',       totalTime: '12h 30m' },
    ],
  },
  {
    id: 3, name: 'Part-time Job', totalTime: '8h 00m', color: '#16a34a',
    subprojects: [],
  },
]

export default function ProjectsPage() {
  const [expanded, setExpanded] = useState(new Set([1]))

  const toggle = (id) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-title">Projects</h2>
        <button className="btn btn-primary btn-sm">+ New Project</button>
      </div>

      <div className="project-list">
        {MOCK_PROJECTS.map(p => (
          <div key={p.id} className="project-card">
            <div className="project-row" onClick={() => toggle(p.id)}>
              <span className="project-chevron">{expanded.has(p.id) ? '▾' : '▸'}</span>
              <span className="project-dot" style={{ background: p.color }} />
              <span className="project-name">{p.name}</span>
              <span className="project-time">{p.totalTime}</span>
              <div className="project-actions" onClick={e => e.stopPropagation()}>
                <button className="btn btn-ghost btn-xs">Edit</button>
                <button className="btn btn-ghost btn-xs">+ Sub</button>
                <button className="btn btn-ghost btn-xs danger">Delete</button>
              </div>
            </div>

            {expanded.has(p.id) && p.subprojects.map(s => (
              <div key={s.id} className="project-row subproject-row">
                <span className="project-chevron" />
                <span className="subproject-indent">↳</span>
                <span className="project-name">{s.name}</span>
                <span className="project-time">{s.totalTime}</span>
                <div className="project-actions">
                  <button className="btn btn-ghost btn-xs">Edit</button>
                  <button className="btn btn-ghost btn-xs danger">Delete</button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Project Detail Preview */}
      <div className="section" style={{ marginTop: '2rem' }}>
        <div className="section-header">
          <h3>AI-Driven Software Dev — Time Summary</h3>
          <div className="date-range-bar">
            <button className="btn btn-ghost btn-xs active">This Week</button>
            <button className="btn btn-ghost btn-xs">This Month</button>
            <button className="btn btn-ghost btn-xs">All Time</button>
          </div>
        </div>
        <table className="task-table">
          <thead>
            <tr><th>Subproject</th><th>Time</th><th>% of Total</th></tr>
          </thead>
          <tbody>
            <tr><td>Weekly Assignments</td><td>12h 00m</td><td>43%</td></tr>
            <tr><td>Final Project</td><td>16h 15m</td><td>57%</td></tr>
            <tr className="total-row"><td><strong>Total</strong></td><td><strong>28h 15m</strong></td><td>100%</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
