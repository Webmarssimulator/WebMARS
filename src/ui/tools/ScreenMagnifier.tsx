import { useEffect, useRef, useState } from 'react'
import { useSimulator } from '@/hooks/useSimulator.ts'

// Phase 3 SA-15 rewrite (Enhancement Plan §8.2): a floating loupe that
// magnifies the panel under the cursor via DOM cloning. The element
// tagged data-magnify-region under the pointer is cloned into the loupe
// and rendered at 2x with a CSS transform — no html2canvas, no canvas
// rasterization. Re-clones ONLY when the target region changes, not on
// every mousemove, so there is no per-frame DOM churn.
//
// Activated by Tools menu → Screen Magnifier (toggle). Esc dismisses.
// The Monaco editor is intentionally NOT tagged — its virtualized DOM
// doesn't survive a stable clone; hovering it shows the hint instead
// (the Help dialog points those users at OS-level zoom).

const ZOOM = 2
const SIZE_W = 240
const SIZE_H = 160

export function ScreenMagnifier() {
  const on     = useSimulator((s) => s.screenMagnifierOn)
  const toggle = useSimulator((s) => s.toggleScreenMagnifier)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  // The region under the cursor. Held in state (not a ref) because the
  // render pass positions the clone from its bounding rect.
  const [target, setTarget] = useState<Element | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Mouse and Escape wiring. The target region is resolved inside the
  // mousemove handler: closest() walks to the region root, so small
  // movements within the same panel resolve to the SAME element and
  // the state set is a no-op (no re-clone, no re-render churn). The
  // loupe itself has pointerEvents: none, so elementFromPoint never
  // lands on it.
  useEffect(() => {
    if (!on) return
    function handleMove(event: MouseEvent) {
      setPos({ x: event.clientX, y: event.clientY })
      const under = document.elementFromPoint(event.clientX, event.clientY)
      const next = under?.closest('[data-magnify-region]') ?? null
      setTarget((prev) => (prev === next ? prev : next))
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') toggle()
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('keydown', handleKey)
      setTarget(null)
    }
  }, [on, toggle])

  // Clone the target into the loupe — runs only when the TARGET
  // changes, never per mousemove.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.innerHTML = ''
    if (!target) return
    const cloned = target.cloneNode(true) as HTMLElement
    // The clone is a visual snapshot — disarm anything interactive so
    // nothing inside it can receive events, and strip ids so the page
    // keeps unique ids.
    cloned.querySelectorAll('button, input, select, textarea, a').forEach((el) => {
      ;(el as HTMLElement).style.pointerEvents = 'none'
      el.removeAttribute('id')
    })
    cloned.removeAttribute('id')
    container.appendChild(cloned)
  }, [target])

  if (!on) return null

  // Position the loupe just below+right of the cursor so it doesn't
  // sit underneath the user's pointer. Clamp inside the viewport.
  const clientX = Math.min(window.innerWidth - SIZE_W - 12, pos.x + 24)
  const clientY = Math.min(window.innerHeight - SIZE_H - 12, pos.y + 24)

  // Translate so the cursor's position inside the source region lands
  // centered in the loupe at ZOOM scale.
  const rect = target?.getBoundingClientRect()
  const tx = rect ? -(pos.x - rect.left) + SIZE_W / (2 * ZOOM) : 0
  const ty = rect ? -(pos.y - rect.top) + SIZE_H / (2 * ZOOM) : 0

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        left:  clientX,
        top:   clientY,
        width:  SIZE_W,
        height: SIZE_H,
        pointerEvents: 'none',
        zIndex: 70,
        border: '2px solid var(--accent)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
        overflow: 'hidden',
        background: 'var(--surface-elev)',
      }}
    >
      <div
        ref={containerRef}
        style={{
          transform: `scale(${ZOOM}) translate(${tx}px, ${ty}px)`,
          transformOrigin: '0 0',
          pointerEvents: 'none',
          display: target ? undefined : 'none',
        }}
      />
      {!target && (
        <div className="flex h-full w-full items-center justify-center px-3 text-center text-[11px] text-ink-3">
          Hover a panel to magnify
        </div>
      )}
    </div>
  )
}
