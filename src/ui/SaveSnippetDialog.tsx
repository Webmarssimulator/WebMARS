import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import * as api from '@/lib/api.ts'
import { setSnippetIdInUrl } from '@/lib/router.ts'
import { useSimulator } from '@/hooks/useSimulator.ts'
import { cn } from './cn.ts'

// Enhancement Plan §6.5 — first save of a snippet: pick a title and
// visibility (defaults PRIVATE), POST /snippets/save, then hand off to
// the ShareModal. Subsequent saves go straight to PUT via the toolbar
// button and never see this dialog.

export function SaveSnippetDialog() {
  const open = useSimulator((s) => s.saveSnippetDialogOpen)
  // The form mounts fresh on every open, so its state (title prefill,
  // visibility default) initializes at mount — no sync-in-effect.
  if (!open) return null
  return <SaveSnippetForm />
}

function initialTitle(): string {
  const s = useSimulator.getState()
  const active = s.files.find((f) => f.id === s.activeFileId)
  return active ? active.name.replace(/\.(asm|s|mips)$/i, '') : ''
}

function SaveSnippetForm() {
  const close = useSimulator((s) => s.closeSaveSnippetDialog)

  const [title, setTitle] = useState(initialTitle)
  const [visibility, setVisibility] = useState<api.Visibility>('PRIVATE')
  const [busy, setBusy] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  // Keyboard contract: Escape closes, Tab trapped, Enter submits (form).
  useEffect(() => {
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
    titleRef.current?.focus()
    return () => window.removeEventListener('keydown', handleKey)
  }, [close])

  async function submit() {
    if (busy) return
    const trimmed = title.trim()
    if (trimmed.length === 0) {
      toast.error('Give the snippet a title.')
      return
    }
    setBusy(true)
    try {
      const s = useSimulator.getState()
      const snippet = await api.saveSnippet({ title: trimmed, code: s.source, visibility })
      s.setCurrentSnippet({ id: snippet.id, title: snippet.title, visibility: snippet.visibility })
      setSnippetIdInUrl(snippet.id)
      toast.success(`Saved as ${snippet.title ?? trimmed}`)
      close()
      useSimulator.getState().openShareModal()
    } catch (err) {
      toast.error(
        err instanceof api.ApiError
          ? err.status === 401
            ? 'Your session expired. Sign in again to save.'
            : `Save failed (HTTP ${err.status}). Please try again.`
          : 'Save failed. Check your connection.',
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
        aria-label="Save snippet to account"
        className="w-full max-w-sm overflow-hidden rounded-lg border border-divider bg-surface-1 shadow-xl"
      >
        <header className="border-b border-divider px-5 py-3 text-xs font-medium text-ink-1">
          Save to account
        </header>
        <form
          className="flex flex-col gap-3 px-5 py-4"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase text-ink-2" style={{ letterSpacing: '0.06em' }}>
              Title
            </span>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={255}
              disabled={busy}
              className="rounded-sm border border-divider bg-surface-0 px-2 py-1.5 text-xs text-ink-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </label>

          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 font-mono text-[10px] uppercase text-ink-2" style={{ letterSpacing: '0.06em' }}>
              Visibility
            </legend>
            {(
              [
                { value: 'PRIVATE', label: 'Private', sub: 'Only you can open it.' },
                { value: 'PUBLIC', label: 'Public', sub: 'Anyone with the link (and the public feed) can view it.' },
              ] as const
            ).map((option) => (
              <label
                key={option.value}
                className={cn(
                  'flex cursor-pointer items-start gap-2 rounded-sm border px-2 py-1.5 transition-colors',
                  visibility === option.value ? 'border-accent bg-surface-2' : 'border-divider hover:bg-surface-2',
                )}
              >
                <input
                  type="radio"
                  name="visibility"
                  value={option.value}
                  checked={visibility === option.value}
                  onChange={() => setVisibility(option.value)}
                  disabled={busy}
                  className="mt-0.5 size-3.5 flex-none accent-accent"
                />
                <span className="flex-1">
                  <span className="block text-xs text-ink-1">{option.label}</span>
                  <span className="mt-0.5 block text-[11px] text-ink-2">{option.sub}</span>
                </span>
              </label>
            ))}
          </fieldset>

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
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
