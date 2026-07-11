import { Suspense, lazy, useEffect } from 'react'
import { Toaster, toast } from 'sonner'
import { useRoute, getSnippetIdFromUrl } from '@/lib/router.ts'
import * as api from '@/lib/api.ts'
import { Shell } from '@/ui/Shell.tsx'
import { useSimulator, resolveTheme } from '@/hooks/useSimulator.ts'
import { useSystemColorScheme } from '@/hooks/useSystemColorScheme.ts'

// Lazy-load the landing page so the IDE bundle isn't burdened with
// marketing CSS for the default route. Users who deep-link to / get the
// IDE at full speed; only /about visitors pay the landing bundle cost
// (and only once — Vite hashes the chunk).
const LandingPage = lazy(() => import('@/landing/LandingPage.tsx'))

// Enhancement Plan §6.6: visiting /?snippet=<id> loads that snippet
// into the editor on boot; browser back/forward between /?snippet=N
// and / restores the association (popstate, plan D9).
function useSnippetDeepLink(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    function syncFromUrl() {
      const id = getSnippetIdFromUrl()
      const s = useSimulator.getState()
      if (id === null) {
        // Back on plain / — the editor keeps its content but is no
        // longer bound to a server snippet.
        if (s.currentSnippetId !== null) s.setCurrentSnippet(null)
        return
      }
      if (id === s.currentSnippetId) return
      api
        .getSnippet(id)
        .then((snippet) => {
          if (cancelled) return
          useSimulator.getState().loadSnippetIntoEditor(snippet)
          document.title = `${snippet.title ?? `snippet-${snippet.id}`} — WebMARS`
        })
        .catch((err: unknown) => {
          if (cancelled) return
          if (err instanceof api.ApiError && err.status === 404) {
            toast.error('That snippet is private or does not exist.')
          } else {
            toast.error('Failed to load shared snippet.')
          }
        })
    }

    syncFromUrl()
    window.addEventListener('popstate', syncFromUrl)
    return () => {
      cancelled = true
      window.removeEventListener('popstate', syncFromUrl)
    }
  }, [enabled])
}

export default function App() {
  const route = useRoute()
  const theme = useSimulator((s) => s.theme)
  const systemScheme = useSystemColorScheme()
  useSnippetDeepLink(route === 'app')

  // Sonner only knows light/dark; the high-contrast shell keeps the
  // dark toast styling.
  const toasterTheme = resolveTheme(theme, systemScheme) === 'light' ? 'light' : 'dark'

  if (route === 'landing') {
    return (
      <Suspense fallback={<div className="h-dvh w-full bg-surface-0" />}>
        <LandingPage />
      </Suspense>
    )
  }

  return (
    <>
      <Shell />
      <Toaster theme={toasterTheme} position="bottom-right" closeButton richColors />
    </>
  )
}
