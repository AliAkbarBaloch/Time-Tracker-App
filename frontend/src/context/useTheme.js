import { useContext } from 'react'
import { ThemeCtx } from './themeCtx'

export function useTheme() {
  const ctx = useContext(ThemeCtx)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
