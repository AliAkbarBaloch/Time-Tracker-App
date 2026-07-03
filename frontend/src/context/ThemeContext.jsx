import { useState, useEffect } from 'react'
import { ThemeCtx } from './themeCtx'

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('tt_theme') || 'light' } catch { return 'light' }
  })

  useEffect(() => {
    function applyTheme(t) {
      const root = document.documentElement
      if (t === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        root.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
      } else {
        root.setAttribute('data-theme', t)
      }
    }

    applyTheme(theme)
    try { localStorage.setItem('tt_theme', theme) } catch {}

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => applyTheme('system')
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [theme])

  return <ThemeCtx.Provider value={{ theme, setTheme }}>{children}</ThemeCtx.Provider>
}

