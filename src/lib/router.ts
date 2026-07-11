import { useEffect, useState } from 'react'

// Phase 4 routing. The IDE is the default route (/) so existing
// users and direct deep-links land on the editor without an extra
// hop. The marketing landing page lives at /about.
//
// navigate('/about') pushes a new history entry and dispatches a
// synthetic popstate so any subscribed useRoute() instances
// rerender. The browser's back/forward buttons fire popstate
// natively.

export type Route = 'app' | 'landing'

export function getCurrentRoute(): Route {
  if (typeof window === 'undefined') return 'app'
  return window.location.pathname.startsWith('/about') ? 'landing' : 'app'
}

export function navigate(to: '/' | '/about'): void {
  if (typeof window === 'undefined') return
  if (window.location.pathname === to) return
  window.history.pushState({}, '', to)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(getCurrentRoute())
  useEffect(() => {
    function onPop(): void { setRoute(getCurrentRoute()) }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  return route
}

// ─ shared-snippet deep links (Enhancement Plan §6.6) ─
// webmarsimulator.com/?snippet=42 loads snippet 42 on boot; App.tsx
// owns the fetch + popstate wiring, these helpers own the URL shape.

export function getSnippetIdFromUrl(): number | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const raw = params.get('snippet')
  if (!raw) return null
  const id = parseInt(raw, 10)
  return Number.isFinite(id) && id > 0 ? id : null
}

export function setSnippetIdInUrl(id: number | null): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (id === null) url.searchParams.delete('snippet')
  else url.searchParams.set('snippet', String(id))
  window.history.replaceState({}, '', url.toString())
}
