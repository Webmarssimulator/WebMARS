import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import * as api from '@/lib/api.ts'
import { setSnippetIdInUrl } from '@/lib/router.ts'
import { useSimulator } from '@/hooks/useSimulator.ts'
import { ConfirmDialog } from './ConfirmDialog.tsx'
import { cn } from './cn.ts'

// Enhancement Plan D6 — the user's saved snippets: title, last-updated,
// visibility badge; click loads into the editor; edit-in-place title;
// delete with confirm; New Snippet clears the binding so Save creates
// a fresh row. Renders inside the RightPanel accordion.

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; snippets: api.Snippet[] }

function formatWhen(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

export function MySnippetsDrawer() {
  const authToken = useSimulator((s) => s.authToken)
  const openAuthModal = useSimulator((s) => s.openAuthModal)
  const currentSnippetId = useSimulator((s) => s.currentSnippetId)
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [refreshKey, setRefreshKey] = useState(0)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [pendingDelete, setPendingDelete] = useState<api.Snippet | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  // Event handlers flip to 'loading' themselves before bumping the key
  // — the effect only ever sets state from async callbacks.
  function refresh() {
    setState({ kind: 'loading' })
    setRefreshKey((k) => k + 1)
  }

  useEffect(() => {
    if (!authToken) return
    let cancelled = false
    api
      .getMySnippets(0, 100)
      .then((page) => {
        if (!cancelled) setState({ kind: 'ready', snippets: page.content })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setState({
          kind: 'error',
          message:
            err instanceof api.ApiError
              ? `The server could not list your snippets (HTTP ${err.status}).`
              : 'Could not reach the server. Check your connection.',
        })
      })
    return () => {
      cancelled = true
    }
  }, [authToken, refreshKey])

  function loadSnippet(snippet: api.Snippet) {
    useSimulator.getState().loadSnippetIntoEditor(snippet)
    setSnippetIdInUrl(snippet.id)
    toast.success(`Loaded ${snippet.title ?? `snippet-${snippet.id}`}`)
  }

  async function commitTitle(snippet: api.Snippet) {
    const next = editingTitle.trim()
    setEditingId(null)
    if (next.length === 0 || next === snippet.title) return
    try {
      await api.updateSnippet(snippet.id, { title: next })
      toast.success('Title updated')
      refresh()
    } catch (err) {
      toast.error(
        err instanceof api.ApiError
          ? `Rename failed (HTTP ${err.status}). The update endpoint may not be live yet.`
          : 'Rename failed. Check your connection.',
      )
    }
  }

  async function confirmDelete() {
    if (!pendingDelete || deleteBusy) return
    setDeleteBusy(true)
    try {
      await api.deleteSnippet(pendingDelete.id)
      toast.success(`Deleted ${pendingDelete.title ?? 'snippet'}`)
      if (useSimulator.getState().currentSnippetId === pendingDelete.id) {
        useSimulator.getState().setCurrentSnippet(null)
        setSnippetIdInUrl(null)
      }
      setPendingDelete(null)
      refresh()
    } catch (err) {
      toast.error(
        err instanceof api.ApiError
          ? `Delete failed (HTTP ${err.status}).`
          : 'Delete failed. Check your connection.',
      )
    } finally {
      setDeleteBusy(false)
    }
  }

  function newSnippet() {
    const s = useSimulator.getState()
    s.newFile()
    s.setCurrentSnippet(null)
    setSnippetIdInUrl(null)
  }

  if (!authToken) {
    return (
      <div className="rounded-md border border-divider bg-surface-2 p-3 text-xs text-ink-2">
        <span>Sign in to save snippets to your account. </span>
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

  if (state.kind === 'loading' || state.kind === 'idle') {
    return <div className="p-3 text-xs italic text-ink-2">Loading your snippets…</div>
  }

  if (state.kind === 'error') {
    return (
      <div className="rounded-md border border-divider bg-surface-2 p-3 text-xs text-ink-2">
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

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={newSnippet}
        className="self-start rounded-sm bg-surface-2 px-2 py-1 text-xs text-ink-1 transition-colors hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        + New Snippet
      </button>

      {state.snippets.length === 0 ? (
        <div className="rounded-md border border-divider bg-surface-2 p-3 text-xs text-ink-2">
          <div>Save your first snippet to see it here.</div>
          <button
            type="button"
            onClick={() => {
              // Expand + reveal the Public Snippets accordion below.
              const header = document.getElementById('right-panel-public-snippets-header')
              if (header?.getAttribute('aria-expanded') === 'false') header.click()
              header?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
            className="mt-1.5 text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            See public snippets
          </button>
        </div>
      ) : (
        <ul className="flex flex-col gap-1">
          {state.snippets.map((snippet) => (
            <li
              key={snippet.id}
              className={cn(
                'group rounded-sm border px-2 py-1.5',
                snippet.id === currentSnippetId ? 'border-accent bg-surface-2' : 'border-divider hover:bg-surface-2',
              )}
            >
              <div className="flex items-center gap-2">
                {editingId === snippet.id ? (
                  <input
                    type="text"
                    value={editingTitle}
                    autoFocus
                    maxLength={255}
                    onChange={(event) => setEditingTitle(event.target.value)}
                    onBlur={() => void commitTitle(snippet)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void commitTitle(snippet)
                      if (event.key === 'Escape') setEditingId(null)
                    }}
                    aria-label="Snippet title"
                    className="min-w-0 flex-1 rounded-sm border border-divider bg-surface-0 px-1.5 py-0.5 text-xs text-ink-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => loadSnippet(snippet)}
                    title="Load into the editor"
                    className="min-w-0 flex-1 truncate text-left text-xs text-ink-1 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {snippet.title ?? `snippet-${snippet.id}`}
                  </button>
                )}
                <span
                  className={cn(
                    'flex-none rounded-pill px-1.5 py-0.5 font-mono text-[9px] uppercase',
                    snippet.visibility === 'PUBLIC' ? 'bg-ok/15 text-ok' : 'bg-surface-3 text-ink-2',
                  )}
                  style={{ letterSpacing: '0.05em' }}
                >
                  {snippet.visibility === 'PUBLIC' ? 'public' : 'private'}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="font-mono text-[10px] text-ink-2">{formatWhen(snippet.updatedAt)}</span>
                <span className="flex-1" />
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(snippet.id)
                    setEditingTitle(snippet.title ?? '')
                  }}
                  className="text-[10px] text-ink-2 hover:text-ink-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(snippet)}
                  className="text-[10px] text-ink-2 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete snippet"
        message={`Delete ${pendingDelete?.title ?? 'this snippet'}? This cannot be undone.`}
        confirmLabel="Delete"
        busy={deleteBusy}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
