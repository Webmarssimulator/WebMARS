import './tokens.css'
import { navigate } from '@/lib/router'

// Phase 4 SA-1 placeholder. SA-2 expands this into a multi-section
// page; for now it confirms the routing wiring works end-to-end.

export default function LandingPage() {
  return (
    <div className="landing min-h-dvh">
      <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center gap-6 px-6 py-16 text-center">
        <h1 className="text-5xl font-bold" style={{ color: 'var(--l-ink-1)' }}>
          WebMARS
        </h1>
        <p className="text-lg" style={{ color: 'var(--l-ink-2)' }}>
          Modern, browser-based MIPS simulator. Real landing page lands in SA-2.
        </p>
        <button
          type="button"
          onClick={() => navigate('/app')}
          className="rounded-lg px-6 py-3 text-base font-semibold text-white"
          style={{ background: 'var(--l-accent)' }}
        >
          Open the editor →
        </button>
      </main>
    </div>
  )
}
