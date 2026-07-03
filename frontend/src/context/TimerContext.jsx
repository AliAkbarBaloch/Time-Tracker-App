import { useState, useEffect, useCallback } from 'react'
import * as taskApi from '../api/taskApi'
import { TimerContext } from './timerCtx'

function formatElapsed(startTime, totalPreviousSeconds) {
  const currentSecs = Math.max(0, Math.floor((Date.now() - new Date(startTime).getTime()) / 1000))
  const secs = currentSecs + (totalPreviousSeconds || 0)
  const h = String(Math.floor(secs / 3600)).padStart(2, '0')
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0')
  const s = String(secs % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}

export function TimerProvider({ children }) {
  const [activeTask, setActiveTask] = useState(null)
  const [elapsed, setElapsed]       = useState('00:00:00')

  // On mount: rehydrate timer from server (no localStorage — startTime is in DB)
  useEffect(() => {
    taskApi.getActiveTask()
      .then(res => { if (res.status === 200) setActiveTask(res.data) })
      .catch(() => {})
  }, [])

  // SSE: receive live timer events for cross-tab sync
  useEffect(() => {
    if (typeof EventSource === 'undefined') return
    const token = localStorage.getItem('tt_token')
    if (!token) return

    const es = new EventSource(`/api/timer/events?token=${encodeURIComponent(token)}`)

    es.addEventListener('timer-started', e => {
      try { setActiveTask(JSON.parse(e.data)) } catch {}
    })
    es.addEventListener('timer-stopped', () => setActiveTask(null))
    es.onerror = () => es.close()

    return () => es.close()
  }, [])

  // Live clock driven purely by startTime from DB
  useEffect(() => {
    if (!activeTask) { setElapsed('00:00:00'); return }
    const tick = () => setElapsed(formatElapsed(activeTask.startTime, activeTask.totalPreviousSeconds))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [activeTask])

  const startTask = useCallback(async (description) => {
    const { data } = await taskApi.startTask(description || null)
    setActiveTask(data)
    return data
  }, [])

  const stopTask = useCallback(async () => {
    const { data } = await taskApi.stopTask()
    setActiveTask(null)
    return data
  }, [])

  const refreshActiveTask = useCallback(async () => {
    try {
      const res = await taskApi.getActiveTask()
      if (res?.status === 200) setActiveTask(res.data)
      else setActiveTask(null)
    } catch {
      // ignore
    }
  }, [])

  return (
    <TimerContext.Provider value={{ activeTask, elapsed, startTask, stopTask, refreshActiveTask }}>
      {children}
    </TimerContext.Provider>
  )
}

