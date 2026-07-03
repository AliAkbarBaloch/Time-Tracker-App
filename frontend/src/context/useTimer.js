import { useContext } from 'react'
import { TimerContext } from './timerCtx'

export function useTimer() {
  const ctx = useContext(TimerContext)
  if (!ctx) throw new Error('useTimer must be used within TimerProvider')
  return ctx
}
