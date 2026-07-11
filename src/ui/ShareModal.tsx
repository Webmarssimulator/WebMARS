import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import * as api from '@/lib/api.ts'
import { useSimulator } from '@/hooks/useSimulator.ts'
import { cn } from './cn.ts'

// Enhancement Plan §6.5 — after the first save, show the shareable URL
// with a copy button, the snippet's visibility, and a toggle to change
// it (PUT /snippets/{id}).

export function ShareModal() {
  const open = useSimulator((s) => s.shareModalOpen)
  const close = useSimulator((s) => s.closeShareModal)
  const snippetId = useSimulator((s) => s.currentSnippetId)
  const visibility = useSimulator((s) => s.currentSnippetVisibility)
  const title = useSimulator((s) => s.currentSnippetTitle)

  const [busy, setBusy] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const copyRef = useRef<HTMLButtonElement>(null)

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
    copyRef.current?.focus()
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, close])

  if (!open || snippetId === null) return null

  const shareUrl = `${window.location.origin}/?snippet=${snippetId}`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Could not access the clipboard — copy the link manually.')
    }
  }

  async function toggleVisibility() {
    if (busy || snippetId === null) return
    const next: api.Visibility = visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC'
    setBusy(true)
    try {
      const updated = await api.updateSnippet(snippetId, { visibility: next })
      useSimulator.getState().setCurrentSnippet({
        id: updated.id,
        title: updated.title,
        visibility: updated.visibility,
      })
      toast.success(`Snippet is now ${updated.visibility.toLowerCase()}.`)
    } catch (err) {
      // PUT /snippets/{id} may not be deployed yet (it ships with the
      // backend gap PR) — fail with an explanation, never silently.
      toast.error(
        err instanceof api.ApiError
          ? `Could not change visibility (HTTP ${err.status}). The update endpoint may not be live yet.`
          : 'Could not change visibility. Check your connection.',
      )
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
        aria-label="Share snippet"
        className="w-full max-w-md overflow-hidden rounded-lg border border-divider bg-surface-1 shadow-xl"
      >
        <header className="border-b border-divider px-5 py-3 text-xs font-medium text-ink-1">
          Share {title ? `“${title}”` : 'snippet'}
        </header>

        <div className="flex flex-col gap-3 px-5 py-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              onFocus={(event) => event.target.select()}
              aria-label="Shareable link"
              className="flex-1 rounded-sm border border-divider bg-surface-0 px-2 py-1.5 font-mono text-[11px] text-ink-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            <button
              ref={copyRef}
              type="button"
              onClick={() => void copyLink()}
              className="rounded-sm bg-accent px-3 py-1.5 text-xs font-medium text-surface-0 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
            >
              Copy
            </button>
          </div>

          <div className="flex items-center justify-between rounded-sm border border-divider px-3 py-2">
            <div>
              <div className="text-xs text-ink-1">
                Visibility:{' '}
                <span className={visibility === 'PUBLIC' ? 'text-ok' : 'text-warn'}>
                  {visibility === 'PUBLIC' ? 'Public' : 'Private'}
                </span>
              </div>
              <div className="mt-0.5 text-[11px] text-ink-2">
                {visibility === 'PUBLIC'
                  ? 'Anyone with the link can open it.'
                  : 'Only you can open it — the link 404s for everyone else.'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void toggleVisibility()}
              disabled={busy}
              className={cn(
                'rounded-sm bg-surface-2 px-3 py-1.5 text-xs text-ink-1 transition-colors hover:bg-surface-3',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                busy && 'cursor-not-allowed opacity-60',
              )}
            >
              {busy ? 'Updating…' : visibility === 'PUBLIC' ? 'Make private' : 'Make public'}
            </button>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={close}
              className="rounded-sm px-3 py-1.5 text-xs text-ink-2 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
