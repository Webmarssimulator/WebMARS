import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import * as api from '@/lib/api.ts'
import { useSimulator } from '@/hooks/useSimulator.ts'
import { cn } from './cn.ts'

// Enhancement Plan §6.4 — a single dialog with Login and Register tabs.
// Submits to the backend via src/lib/api.ts, stores the token in
// localStorage (via the store's auth slice), and updates the UI.
// Keyboard contract (plan D9): focus lands inside on open, Tab cycles
// within the dialog, Enter submits, Escape closes.

type Mode = 'login' | 'register'

function friendlyAuthError(err: unknown): string {
  if (err instanceof api.ApiError) {
    switch (err.status) {
      case 400: {
        // GlobalExceptionHandler returns a field → message JSON map.
        try {
          const body = JSON.parse(err.body) as Record<string, string>
          const first = Object.values(body)[0]
          if (typeof first === 'string' && first.length > 0) return first
        } catch {
          // fall through to the generic message
        }
        return 'Check your username and password format.'
      }
      case 401: return 'Wrong username or password.'
      case 409: return 'That username is taken.'
      case 429: return 'Too many attempts. Try again in a few minutes.'
      default:  return 'Something went wrong. Please try again.'
    }
  }
  return 'Network error. Check your connection.'
}

export function AuthModal() {
  const open = useSimulator((s) => s.authModalOpen)
  const close = useSimulator((s) => s.closeAuthModal)
  const setAuth = useSimulator((s) => s.setAuth)

  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const usernameRef = useRef<HTMLInputElement>(null)

  // Escape closes; initial focus lands on the username field; Tab is
  // trapped inside the dialog while it is open.
  useEffect(() => {
    if (!open) return
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        close()
        return
      }
      if (event.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, input, [tabindex]:not([tabindex="-1"])',
        )
        if (focusables.length === 0) return
        const first = focusables[0]!
        const last = focusables[focusables.length - 1]!
        const active = document.activeElement
        if (event.shiftKey && (active === first || !dialogRef.current.contains(active))) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && active === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    usernameRef.current?.focus()
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, close])

  if (!open) return null

  async function submit() {
    if (busy) return
    const name = username.trim()
    if (name.length === 0 || password.length === 0) {
      toast.error('Enter a username and password.')
      return
    }
    setBusy(true)
    try {
      if (mode === 'register') {
        await api.register(name, password)
        toast.success('Account created. Signing you in…')
      }
      const { token } = await api.login(name, password)
      setAuth(token, name)
      toast.success(`Signed in as ${name}`)
      setUsername('')
      setPassword('')
      close()
    } catch (err) {
      toast.error(friendlyAuthError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'login' ? 'Sign in' : 'Create account'}
        className="w-full max-w-sm overflow-hidden rounded-lg border border-divider bg-surface-1 shadow-xl"
      >
        {/* Tab strip — Login / Register */}
        <div role="tablist" aria-label="Authentication mode" className="flex border-b border-divider">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              role="tab"
              type="button"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                'flex-1 px-4 py-2.5 text-xs font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
                mode === m
                  ? 'bg-surface-2 text-ink-1'
                  : 'text-ink-3 hover:bg-surface-2 hover:text-ink-2',
              )}
            >
              {m === 'login' ? 'Sign in' : 'Register'}
            </button>
          ))}
        </div>

        <form
          className="flex flex-col gap-3 px-5 py-4"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase text-ink-3" style={{ letterSpacing: '0.06em' }}>
              Username
            </span>
            <input
              ref={usernameRef}
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              minLength={3}
              maxLength={32}
              disabled={busy}
              className="rounded-sm border border-divider bg-surface-0 px-2 py-1.5 text-xs text-ink-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase text-ink-3" style={{ letterSpacing: '0.06em' }}>
              Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              minLength={8}
              disabled={busy}
              className="rounded-sm border border-divider bg-surface-0 px-2 py-1.5 text-xs text-ink-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </label>

          <div className="mt-1 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={close}
              disabled={busy}
              className="rounded-sm px-3 py-1.5 text-xs text-ink-2 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className={cn(
                'rounded-sm bg-accent px-3 py-1.5 text-xs font-medium text-surface-0 transition-opacity',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
                busy && 'cursor-not-allowed opacity-60',
              )}
            >
              {busy
                ? mode === 'login' ? 'Signing in…' : 'Creating account…'
                : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
