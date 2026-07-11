import { useEffect, useState } from 'react'

// Tracks the OS-level color-scheme preference, live. Used by the
// 'system' theme option so the shell and Monaco follow the OS without
// a reload.

export type SystemColorScheme = 'light' | 'dark'

function readSystemScheme(): SystemColorScheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useSystemColorScheme(): SystemColorScheme {
  const [scheme, setScheme] = useState<SystemColorScheme>(readSystemScheme)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setScheme(mq.matches ? 'dark' : 'light')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return scheme
}
