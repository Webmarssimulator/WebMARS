import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Workspace persistence (REQ-001): editor content survives a refresh,
// simulator state does not. The store module reads localStorage at
// import time, so each test stubs window + localStorage first and then
// dynamically imports a FRESH copy of the store via vi.resetModules().

function makeLocalStorageStub(seed: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(seed))
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    _dump: () => Object.fromEntries(store),
  }
}

type StoreModule = typeof import('../hooks/useSimulator')

async function importFreshStore(seed: Record<string, string> = {}) {
  const localStorage = makeLocalStorageStub(seed)
  vi.stubGlobal('window', {
    localStorage,
    innerWidth: 1440,
    innerHeight: 900,
    addEventListener: () => {},
    removeEventListener: () => {},
    matchMedia: () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  })
  vi.resetModules()
  const mod: StoreModule = await import('../hooks/useSimulator')
  return { mod, localStorage }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('workspace persistence', () => {
  it('writes the workspace key after the source changes (debounced)', async () => {
    const { mod, localStorage } = await importFreshStore()
    mod.useSimulator.getState().setSource('addi $t0, $zero, 999')
    vi.advanceTimersByTime(300)

    const raw = localStorage.getItem(mod.WORKSPACE_STORAGE_KEY)
    expect(raw).not.toBeNull()
    const payload = JSON.parse(raw!) as { files: Array<{ source: string }> }
    expect(payload.files.some((f) => f.source === 'addi $t0, $zero, 999')).toBe(true)
  })

  it('rehydrates source and active file from a persisted workspace', async () => {
    const seeded = {
      'webmars:workspace-v1': JSON.stringify({
        files: [
          { id: 'a', name: 'a.asm', source: 'li $t0, 1', modified: false },
          { id: 'b', name: 'b.asm', source: 'li $t1, 2', modified: true },
        ],
        activeFileId: 'b',
      }),
    }
    const { mod } = await importFreshStore(seeded)
    const s = mod.useSimulator.getState()
    expect(s.source).toBe('li $t1, 2')
    expect(s.activeFileId).toBe('b')
    expect(s.files).toHaveLength(2)
    // Handles are not serializable; they rehydrate as null.
    expect(s.files.every((f) => f.handle === null)).toBe(true)
  })

  it('never persists simulator state (registers, memory, console)', async () => {
    const { mod, localStorage } = await importFreshStore()
    mod.useSimulator.getState().setSource('li $v0, 10\nsyscall\n')
    vi.advanceTimersByTime(300)

    const raw = localStorage.getItem(mod.WORKSPACE_STORAGE_KEY)!
    const payload = JSON.parse(raw) as Record<string, unknown>
    expect(Object.keys(payload).sort()).toEqual(['activeFileId', 'files'])
    expect(raw).not.toContain('registers')
    expect(raw).not.toContain('consoleOutput')
    expect(raw).not.toContain('programCounter')
  })

  it('falls back to the default file when the payload is corrupt', async () => {
    const { mod } = await importFreshStore({ 'webmars:workspace-v1': '{not json' })
    const s = mod.useSimulator.getState()
    expect(s.files).toHaveLength(1)
    expect(s.files[0]?.name).toBe('hello.asm')
    expect(s.source).toContain('Welcome to WebMARS')
  })
})
