import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import * as api from '@/lib/api.ts'
import { setSnippetIdInUrl } from '@/lib/router.ts'
import { useSimulator } from '@/hooks/useSimulator.ts'

// Enhancement Plan D7 — browse public snippets: title, owner username,
// last-updated, click-to-load, Previous/Next pagination. Renders inside
// the RightPanel accordion; anonymous users can browse and load.

const PAGE_SIZE = 20

type FeedState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; page: api.Page<api.Snippet> }

function formatWhen(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { dateStyle: 'short' })
}

export function PublicFeed() {
  const [pageIndex, setPageIndex] = useState(0)
  const [state, setState] = useState<FeedState>({ kind: 'loading' })
  const [refreshKey, setRefreshKey] = useState(0)

  // Event handlers flip to 'loading' themselves — the effect only sets
  // state from async callbacks.
  function refresh() {
    setState({ kind: 'loading' })
    setRefreshKey((k) => k + 1)
  }

  function goToPage(next: number) {
    setState({ kind: 'loading' })
    setPageIndex(next)
  }

  useEffect(() => {
    let cancelled = false
    api
      .getPublicSnippets(pageIndex, PAGE_SIZE)
      .then((page) => {
        if (!cancelled) setState({ kind: 'ready', page })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({
          kind: 'error',
          message:
            err instanceof api.ApiError
              ? `The server could not list public snippets (HTTP ${err.status}).`
              : 'Could not reach the server. Check your connection.',
        })
      })
    return () => {
      cancelled = true
    }
  }, [pageIndex, refreshKey])

  function loadSnippet(snippet: api.Snippet) {
    useSimulator.getState().loadSnippetIntoEditor(snippet)
    setSnippetIdInUrl(snippet.id)
    toast.success(`Loaded ${snippet.title ?? `snippet-${snippet.id}`}`)
  }

  if (state.kind === 'loading') {
    return <div className="p-3 text-xs italic text-ink-3">Loading public snippets…</div>
  }

  if (state.kind === 'error') {
    return (
      <div className="rounded-md border border-divider bg-surface-2 p-3 text-xs text-ink-3">
        <div className="text-danger">{state.message}</div>
        <button
          type="button"
          onClick={refresh}
          className="mt-2 rounded-sm bg-surface-3 px-2 py-1 text-xs text-ink-1 transition-colors hover:bg-surface-3/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Retry
        </button>
      </div>
    )
  }

  const { page } = state

  return (
    <div className="flex flex-col gap-2">
      {page.content.length === 0 ? (
        <div className="rounded-md border border-divider bg-surface-2 p-3 text-xs text-ink-3">
          No public snippets yet. Be the first.
        </div>
      ) : (
        <ul className="flex flex-col gap-1">
          {page.content.map((snippet) => (
            <li key={snippet.id} className="rounded-sm border border-divider px-2 py-1.5 hover:bg-surface-2">
              <button
                type="button"
                onClick={() => loadSnippet(snippet)}
                title="Load into the editor"
                className="block w-full truncate text-left text-xs text-ink-1 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {snippet.title ?? `snippet-${snippet.id}`}
              </button>
              <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-ink-3">
                <span>{snippet.owner?.username ?? 'unknown'}</span>
                <span className="flex-1" />
                <span>{formatWhen(snippet.updatedAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {(page.totalPages ?? 0) > 1 && (
        <nav aria-label="Public snippets pages" className="flex items-center justify-between">
          <button
            type="button"
            disabled={page.first}
            onClick={() => goToPage(Math.max(0, pageIndex - 1))}
            className="rounded-sm bg-surface-2 px-2 py-1 text-xs text-ink-1 transition-colors hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            ← Previous
          </button>
          <span className="font-mono text-[10px] text-ink-3">
            Page {page.number + 1} of {page.totalPages}
          </span>
          <button
            type="button"
            disabled={page.last}
            onClick={() => goToPage(pageIndex + 1)}
            className="rounded-sm bg-surface-2 px-2 py-1 text-xs text-ink-1 transition-colors hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Next →
          </button>
        </nav>
      )}
    </div>
  )
}
