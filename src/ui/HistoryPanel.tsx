import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import * as api from '@/lib/api.ts'
import { setSnippetIdInUrl } from '@/lib/router.ts'
import { useSimulator } from '@/hooks/useSimulator.ts'
import { cn } from './cn.ts'

// Enhancement Plan D8 — run history in the right inspector: Recent Runs
// (status badge, duration, timestamp) and Most Run (count, last run).
// Clicking a row loads that snippet into the editor. Refetches when a
// run is logged (runLogVersion bump from the §8.3 hook).

// Each half loads independently so one failing endpoint (e.g. the
// upstream /runs/recent bug) can't blank the other's data.
type SectionState<T> =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; items: T[] }

function sectionError(err: unknown, what: string): { kind: 'error'; message: string } {
  return {
    kind: 'error',
    message:
      err instanceof api.ApiError
        ? `The server could not load ${what} (HTTP ${err.status}).`
        : `Could not reach the server for ${what}.`,
  }
}

const STATUS_BADGE: Record<api.ExitStatus, string> = {
  COMPLETED: 'bg-ok/15 text-ok',
  ERROR: 'bg-danger/15 text-danger',
  ABORTED: 'bg-warn/15 text-warn',
  PAUSED: 'bg-surface-3 text-ink-3',
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

function formatDuration(ms: number | null): string {
  if (ms === null) return ''
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

function SectionFallback({ state, onRetry }: { state: SectionState<unknown>; onRetry: () => void }) {
  if (state.kind === 'loading') return <div className="text-[11px] italic text-ink-3">Loading…</div>
  if (state.kind === 'error') {
    return (
      <div className="rounded-md border border-divider bg-surface-2 p-2 text-[11px] text-ink-3">
        <div className="text-danger">{state.message}</div>
        <button
          type="button"
          onClick={onRetry}
          className="mt-1.5 rounded-sm bg-surface-3 px-2 py-0.5 text-[11px] text-ink-1 transition-colors hover:bg-surface-3/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Retry
        </button>
      </div>
    )
  }
  return <div className="text-[11px] italic text-ink-3">No runs yet.</div>
}

export function HistoryPanel() {
  const authToken = useSimulator((s) => s.authToken)
  const openAuthModal = useSimulator((s) => s.openAuthModal)
  const runLogVersion = useSimulator((s) => s.runLogVersion)
  const [recent, setRecent] = useState<SectionState<api.Run>>({ kind: 'loading' })
  const [mostRun, setMostRun] = useState<SectionState<api.MostRun>>({ kind: 'loading' })
  const [refreshKey, setRefreshKey] = useState(0)

  function refresh() {
    setRecent({ kind: 'loading' })
    setMostRun({ kind: 'loading' })
    setRefreshKey((k) => k + 1)
  }

  useEffect(() => {
    if (!authToken) return
    let cancelled = false
    api
      .getRecentRuns(20)
      .then((items) => {
        if (!cancelled) setRecent({ kind: 'ready', items })
      })
      .catch((err: unknown) => {
        if (!cancelled) setRecent(sectionError(err, 'recent runs'))
      })
    api
      .getMostRunPrograms(10)
      .then((items) => {
        if (!cancelled) setMostRun({ kind: 'ready', items })
      })
      .catch((err: unknown) => {
        if (!cancelled) setMostRun(sectionError(err, 'most-run programs'))
      })
    return () => {
      cancelled = true
    }
  }, [authToken, refreshKey, runLogVersion])

  function loadSnippetById(id: number) {
    api
      .getSnippet(id)
      .then((snippet) => {
        useSimulator.getState().loadSnippetIntoEditor(snippet)
        setSnippetIdInUrl(snippet.id)
        toast.success(`Loaded ${snippet.title ?? `snippet-${snippet.id}`}`)
      })
      .catch((err: unknown) => {
        toast.error(
          err instanceof api.ApiError && err.status === 404
            ? 'That snippet no longer exists.'
            : 'Could not load the snippet.',
        )
      })
  }

  if (!authToken) {
    return (
      <div className="rounded-md border border-divider bg-surface-2 p-3 text-xs text-ink-3">
        <span>Sign in to record and see your run history. </span>
        <button
          type="button"
          onClick={openAuthModal}
          className="text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Sign in
        </button>
      </div>
    )
  }

  if (recent.kind === 'loading' && mostRun.kind === 'loading') {
    return <div className="p-3 text-xs italic text-ink-3">Loading run history…</div>
  }

  if (
    recent.kind === 'ready' &&
    mostRun.kind === 'ready' &&
    recent.items.length === 0 &&
    mostRun.items.length === 0
  ) {
    return (
      <div className="rounded-md border border-divider bg-surface-2 p-3 text-xs text-ink-3">
        Run a saved snippet to see your history here.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <section>
        <h4 className="mb-1.5 font-mono text-[10px] uppercase text-ink-3" style={{ letterSpacing: '0.06em' }}>
          Recent Runs
        </h4>
        {recent.kind !== 'ready' || recent.items.length === 0 ? (
          <SectionFallback state={recent} onRetry={refresh} />
        ) : (
          <ul className="flex flex-col gap-1">
            {recent.items.map((run) => (
              <li key={run.id} className="rounded-sm border border-divider px-2 py-1.5 hover:bg-surface-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => loadSnippetById(run.snippetId)}
                    title="Load this snippet into the editor"
                    className="min-w-0 flex-1 truncate text-left text-xs text-ink-1 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {run.snippetTitle ?? `snippet-${run.snippetId}`}
                  </button>
                  <span
                    className={cn(
                      'flex-none rounded-pill px-1.5 py-0.5 font-mono text-[9px] uppercase',
                      STATUS_BADGE[run.exitStatus],
                    )}
                    style={{ letterSpacing: '0.05em' }}
                  >
                    {run.exitStatus.toLowerCase()}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-ink-3">
                  <span>{formatWhen(run.startedAt)}</span>
                  <span className="flex-1" />
                  <span>{formatDuration(run.durationMs)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4 className="mb-1.5 font-mono text-[10px] uppercase text-ink-3" style={{ letterSpacing: '0.06em' }}>
          Most Run
        </h4>
        {mostRun.kind !== 'ready' || mostRun.items.length === 0 ? (
          <SectionFallback state={mostRun} onRetry={refresh} />
        ) : (
          <ul className="flex flex-col gap-1">
            {mostRun.items.map((entry) => (
              <li key={entry.snippetId} className="rounded-sm border border-divider px-2 py-1.5 hover:bg-surface-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => loadSnippetById(entry.snippetId)}
                    title="Load this snippet into the editor"
                    className="min-w-0 flex-1 truncate text-left text-xs text-ink-1 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {entry.snippetTitle ?? `snippet-${entry.snippetId}`}
                  </button>
                  <span className="flex-none font-mono text-[10px] text-ink-2">
                    ×{entry.runCount}
                  </span>
                </div>
                <div className="mt-0.5 font-mono text-[10px] text-ink-3">
                  last run {formatWhen(entry.lastRun)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
