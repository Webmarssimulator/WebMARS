import { afterEach, describe, expect, it, vi } from 'vitest'
import * as api from '../lib/api'

// The vitest config runs in a node environment: `window` is undefined
// until stubbed. Each test that needs an auth token stubs a minimal
// window.localStorage; fetch is stubbed per-test to capture the request.

function stubToken(token: string | null) {
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => (key === api.TOKEN_STORAGE_KEY ? token : null),
    },
  })
}

function stubFetch(status: number, body: unknown): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
    json: () => Promise.resolve(body),
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('api client', () => {
  it('attaches the Authorization header when a token exists', async () => {
    stubToken('abc.def.ghi')
    const fetchMock = stubFetch(200, [])

    await api.getRecentRuns()

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer abc.def.ghi')
  })

  it('omits the Authorization header when no token exists', async () => {
    stubToken(null)
    const fetchMock = stubFetch(200, { content: [] })

    await api.getPublicSnippets()

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('throws ApiError with the response status on non-2xx', async () => {
    stubToken(null)
    stubFetch(401, 'Invalid credentials')

    const err = await api.login('user', 'wrong').catch((e: unknown) => e)

    expect(err).toBeInstanceOf(api.ApiError)
    expect((err as api.ApiError).status).toBe(401)
    expect((err as api.ApiError).body).toBe('Invalid credentials')
  })

  it('sends JSON bodies with Content-Type on writes', async () => {
    stubToken('tkn')
    const fetchMock = stubFetch(200, { id: 1 })

    await api.saveSnippet({ title: 'T', code: 'li $t0, 1', visibility: 'PUBLIC' })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/snippets/save')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body as string)).toEqual({
      title: 'T',
      code: 'li $t0, 1',
      visibility: 'PUBLIC',
    })
  })

  it('resolves undefined for 204 responses', async () => {
    stubToken('tkn')
    stubFetch(204, '')

    await expect(api.deleteSnippet(7)).resolves.toBeUndefined()
  })
})
