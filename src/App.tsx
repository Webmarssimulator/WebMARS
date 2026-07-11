import { Suspense, lazy } from 'react'
import { Toaster } from 'sonner'
import { useRoute } from '@/lib/router.ts'
import { Shell } from '@/ui/Shell.tsx'
import { useSimulator } from '@/hooks/useSimulator.ts'

// Lazy-load the landing page so the IDE bundle isn't burdened with
// marketing CSS for the default route. Users who deep-link to / get the
// IDE at full speed; only /about visitors pay the landing bundle cost
// (and only once — Vite hashes the chunk).
const LandingPage = lazy(() => import('@/landing/LandingPage.tsx'))

export default function App() {
  const route = useRoute()
  const theme = useSimulator((s) => s.theme)

  // Sonner only knows light/dark; the high-contrast shell keeps the
  // dark toast styling.
  const toasterTheme = theme === 'light' ? 'light' : 'dark'

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
