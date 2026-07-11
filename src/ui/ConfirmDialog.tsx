import { useEffect, useRef } from 'react'
import { cn } from './cn.ts'

// Reusable destructive-action confirm (Enhancement Plan D9):
// "<message>" [Cancel] [<confirmLabel>]. Escape cancels, Tab is
// trapped, initial focus lands on Cancel (the safe default), Enter
// activates the focused button.

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCancel()
        return
      }
      if (event.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>('button')
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
    cancelRef.current?.focus()
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-xs overflow-hidden rounded-lg border border-divider bg-surface-1 shadow-xl"
      >
        <div className="px-5 py-4">
          <div className="text-xs font-medium text-ink-1">{title}</div>
          <div className="mt-1.5 text-[11px] leading-relaxed text-ink-2">{message}</div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-divider px-5 py-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-sm px-3 py-1.5 text-xs text-ink-2 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cn(
              'rounded-sm bg-danger px-3 py-1.5 text-xs font-medium text-surface-0 transition-opacity hover:opacity-90',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-1',
              busy && 'cursor-not-allowed opacity-60',
            )}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
