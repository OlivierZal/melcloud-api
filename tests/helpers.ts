import { type MockInstance, expect, vi } from 'vitest'

import type { Logger, SettingManager } from '../src/api/index.ts'
import type { Result } from '../src/types/index.ts'
import { HttpClient, HttpError } from '../src/http/index.ts'

export function cast(value: unknown): never
export function cast(value: unknown): unknown {
  return value
}

// Wrap `expect.objectContaining` so call sites get a `never`-typed
// matcher (assignable anywhere) instead of `any` — the latter trips
// `@typescript-eslint/no-unsafe-assignment` when nested inside another
// matcher's shape literal. Keeps the unsafe-return concession at one
// boundary instead of scattered across every test file.
export function matchObject(shape: object): never
export function matchObject(shape: object): unknown {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- vitest's `objectContaining` is typed `any`; this helper is the single boundary that scopes the concession
  return expect.objectContaining(shape)
}

export const defined = <T>(value: T | null | undefined): T => {
  if (value === undefined || value === null) {
    throw new Error('Expected value to be defined')
  }
  return value
}

/**
 * Test-only helper: assert that a `Result` is `ok` and return its value.
 * Lets tests assert on the success payload without manual narrowing
 * boilerplate at every call site (`result.ok && result.value.X`).
 * @param result - The {@link Result} to unwrap.
 * @returns The success value.
 * @throws An `Error` summarising the failure variant when `result.ok` is `false`.
 */
export const okValue = <T>(result: Result<T>): T => {
  if (!result.ok) {
    throw new Error(`Expected ok result, got ${JSON.stringify(result.error)}`)
  }
  return result.value
}

const HTTP_OK = 200

export function mock<T extends object>(value?: Partial<T>): T
export function mock(value: unknown = {}): unknown {
  return value
}

/**
 * Spin up an `HttpClient` instance and a Vitest spy on its `request`
 * method in one call. Centralises the four-file duplication of
 *
 *     const client = new HttpClient({ baseURL, timeout: 30_000 })
 *     const requestSpy = vi.spyOn(client, 'request')
 *
 * so tests can do `const { client, requestSpy } = createMockHttpClient(url)`.
 * @param baseURL - Base URL forwarded to the underlying HttpClient.
 * @returns The wired client + a spy on `request`.
 */
export const createMockHttpClient = (
  baseURL: string,
): {
  client: HttpClient
  requestSpy: MockInstance<HttpClient['request']>
} => {
  const client = new HttpClient({ baseURL, timeout: 30_000 })
  return { client, requestSpy: vi.spyOn(client, 'request') }
}

export const createSettingStore = (
  initial: Record<string, string> = {},
): {
  setSpy: ReturnType<typeof vi.fn<(key: string, value: string) => void>>
  settingManager: SettingManager
} => {
  const store = new Map(Object.entries(initial))
  const setSpy = vi.fn((key: string, value: string) => {
    store.set(key, value)
  })
  return {
    setSpy,
    settingManager: {
      set: setSpy,
      get: (key: string) => store.get(key) ?? null,
    },
  }
}

export const createLogger = (): Logger => ({
  error: vi.fn<(...data: unknown[]) => void>(),
  log: vi.fn<(...data: unknown[]) => void>(),
})

export const mockResponse = (
  data: unknown,
  headers: Record<string, string | string[]> = {},
  status: number = HTTP_OK,
): {
  data: unknown
  headers: Record<string, string | string[]>
  status: number
} => ({
  data,
  headers,
  status,
})

// The Response constructor rejects a non-null body on the "null body"
// statuses defined in the Fetch spec. Listed explicitly so mocked
// fetches can model those responses without hitting the guard.
const HTTP_SWITCHING_PROTOCOLS = 101
const HTTP_EARLY_HINTS = 103
const HTTP_NO_CONTENT = 204
const HTTP_RESET_CONTENT = 205
const HTTP_NOT_MODIFIED = 304
const NULL_BODY_STATUSES: ReadonlySet<number> = new Set([
  HTTP_EARLY_HINTS,
  HTTP_NO_CONTENT,
  HTTP_NOT_MODIFIED,
  HTTP_RESET_CONTENT,
  HTTP_SWITCHING_PROTOCOLS,
])

const buildMockHeaders = (
  headers: Record<string, string | string[]>,
): Headers => {
  const result = new Headers()
  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        result.append(key, item)
      }
    } else {
      result.set(key, value)
    }
  }
  return result
}

const serializeBody = (body: unknown): string => {
  if (typeof body === 'string') {
    return body
  }
  return JSON.stringify(body)
}

/**
 * Build a fetch-compatible Response mock. The token-auth flow uses
 * `fetch()` directly (not the internal HttpClient) and relies on the
 * Response surface: `.status`, `.ok`, `.text()`, `.headers.get()`, and
 * `.headers.getSetCookie()`.
 * @param body - Response body; objects are JSON-serialised, strings pass
 *   through.
 * @param headers - Response headers; `set-cookie` may be an array.
 * @param status - Response status (defaults to 200).
 * @returns A minimal `Response` object sufficient for the token-auth
 *   flow tests.
 */
export const mockFetchResponse = (
  body: unknown,
  headers: Record<string, string | string[]> = {},
  status: number = HTTP_OK,
): Response => {
  const responseHeaders = buildMockHeaders(headers)
  if (
    typeof body === 'object' &&
    body !== null &&
    !responseHeaders.has('content-type')
  ) {
    responseHeaders.set('content-type', 'application/json')
  }
  return new Response(
    NULL_BODY_STATUSES.has(status) ? null : serializeBody(body),
    { headers: responseHeaders, status },
  )
}

export const createHttpError = ({
  message,
  method = 'get',
  responseHeaders = {},
  status,
  url,
}: {
  message: string
  status: number
  url: string
  method?: string
  responseHeaders?: Record<string, string>
}): HttpError =>
  new HttpError(
    message,
    { data: {}, headers: responseHeaders, status },
    { method, url },
  )

export const createServerError = (status: number, url = '/test'): HttpError =>
  createHttpError({ message: `Status ${String(status)}`, status, url })

export const createUnauthorizedError = (url = '/test'): HttpError =>
  createHttpError({ message: 'Unauthorized', status: 401, url })
