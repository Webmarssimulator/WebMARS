// Typed HTTP client for the WebMARS API (webmars-api). Every part of the
// UI talks to the backend through this module — no raw fetch calls
// anywhere else in src/. Centralizes the auth header, error handling,
// and the environment-configurable base URL.

const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080'

export const TOKEN_STORAGE_KEY = 'webmars.token'
export const USERNAME_STORAGE_KEY = 'webmars.username'

/** Non-2xx responses surface as ApiError so callers can distinguish
 *  401 (bad credentials), 404 (missing/private), 409 (conflict), 429
 *  (rate limited) and 5xx without string-matching messages. */
export class ApiError extends Error {
  readonly status: number
  readonly body: string

  constructor(status: number, body: string) {
    super(`HTTP ${status}: ${body || '(no body)'}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

function readToken(): string | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    // localStorage can throw under privacy mode — treat as signed out.
    return null
  }
}

function authHeader(): Record<string, string> {
  const t = readToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader(),
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new ApiError(res.status, body)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ── Auth ──────────────────────────────────────────────────────────

export interface RegisterResponse {
  message: string
  username: string
}
export interface LoginResponse {
  token: string
}

export const register = (username: string, password: string) =>
  request<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })

export const login = (username: string, password: string) =>
  request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })

// ── Snippets ──────────────────────────────────────────────────────

export type Visibility = 'PUBLIC' | 'PRIVATE'

/** Owner as serialized by the API — only the username survives
 *  (@JsonIgnoreProperties hides id/password/createdAt). */
export interface SnippetOwner {
  username: string
}

export interface Snippet {
  id: number
  title: string | null
  code: string
  owner: SnippetOwner | null
  visibility: Visibility
  createdAt: string
  updatedAt: string
}

/** Spring Data page envelope, as returned by /snippets/mine and
 *  /snippets/public. */
export interface Page<T> {
  content: T[]
  totalPages: number
  totalElements: number
  number: number
  first: boolean
  last: boolean
}

export const getSnippet = (id: number) => request<Snippet>(`/snippets/${id}`)

export const getMySnippets = (page = 0, size = 20) =>
  request<Page<Snippet>>(`/snippets/mine?page=${page}&size=${size}`)

export const getPublicSnippets = (page = 0, size = 20) =>
  request<Page<Snippet>>(`/snippets/public?page=${page}&size=${size}`)

export const saveSnippet = (body: { title: string; code: string; visibility?: Visibility }) =>
  request<Snippet>('/snippets/save', { method: 'POST', body: JSON.stringify(body) })

export const updateSnippet = (
  id: number,
  body: Partial<{ title: string; code: string; visibility: Visibility }>,
) => request<Snippet>(`/snippets/${id}`, { method: 'PUT', body: JSON.stringify(body) })

export const deleteSnippet = (id: number) =>
  request<void>(`/snippets/${id}`, { method: 'DELETE' })

// ── Runs ──────────────────────────────────────────────────────────

export type ExitStatus = 'COMPLETED' | 'ERROR' | 'PAUSED' | 'ABORTED'

export interface Run {
  id: number
  snippetId: number
  snippetTitle: string | null
  startedAt: string
  durationMs: number | null
  instructionsExecuted: number | null
  exitStatus: ExitStatus
}

export interface MostRun {
  snippetId: number
  snippetTitle: string | null
  runCount: number
  lastRun: string
}

export const logRun = (body: {
  snippetId: number
  durationMs?: number
  instructionsExecuted?: number
  exitStatus: ExitStatus
  errorMessage?: string
}) => request<Run>('/runs', { method: 'POST', body: JSON.stringify(body) })

export const getRecentRuns = (limit = 20) => request<Run[]>(`/runs/recent?limit=${limit}`)

export const getMostRunPrograms = (limit = 10) =>
  request<MostRun[]>(`/runs/most-run?limit=${limit}`)
