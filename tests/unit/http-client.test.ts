import { HttpClient as CoreHttpClient } from '@olivierzal/api-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  HttpClient,
  HttpError,
  HttpStatus,
  isHttpError,
} from '../../src/http/index.ts'
import { redaction } from '../../src/observability/context.ts'
import { cast, mockFetchResponse } from '../helpers.ts'

// Thin WIRING suite: the transport MECHANISM (URL building, body
// serialization, signals, parsing — and its full suite) lives in
// @olivierzal/api-core. What this file pins is the MELCloud layer's
// own obligation: the subclass seats this SDK's vocabulary on every
// construction path, so no client — including one a host prebuilds —
// can throw an unredacted snapshot.

const mockFetch = vi.fn<typeof fetch>()
vi.stubGlobal('fetch', mockFetch)

const extractHeaders = (): Record<string, string> => {
  const init = mockFetch.mock.calls[0]?.[1]
  if (init === undefined) {
    throw new TypeError('mockFetch was not called')
  }
  return cast(init.headers)
}

describe(HttpClient, () => {
  const BASE_URL = 'https://api.test.local'

  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('is the core transport (instanceof holds across the family)', () => {
    const client = new HttpClient({ baseURL: BASE_URL, timeout: 0 })

    expect(client).toBeInstanceOf(HttpClient)
    expect(client).toBeInstanceOf(CoreHttpClient)
    expect(client.baseURL).toBe(BASE_URL)
  })

  // The 2026-08-21 clause, now proving the SUBCLASS: the error a real
  // request throws must not carry the credentials that request just
  // sent — the MELCloud context key (this SDK's vocabulary) and the
  // bearer token (the core base) alike, with NOTHING passed at the
  // construction site.
  it('redacts the credentials of the request that failed', async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse({ err: 'denied' }, {}, 403),
    )
    const client = new HttpClient({
      baseURL: BASE_URL,
      headers: { 'X-MitsContextKey': 'ctx' },
      timeout: 0,
    })

    const promise = client.request({
      headers: { Authorization: 'Bearer secret', 'X-Trace': 'keep-me' },
      url: '/guarded',
    })

    await expect(promise).rejects.toMatchObject({
      config: {
        headers: {
          Authorization: '******',
          'X-MitsContextKey': '******',
          'X-Trace': 'keep-me',
        },
      },
    })
    // Redaction is a reporting concern, not a transport one: the wire
    // still carried the real credential.
    expect(extractHeaders().Authorization).toBe('Bearer secret')
  })

  it('throws the shared HttpError class', async () => {
    mockFetch.mockResolvedValueOnce(mockFetchResponse({}, {}, 500))
    const client = new HttpClient({ baseURL: BASE_URL, timeout: 0 })

    const promise = client.request({ url: '/boom' })

    await expect(promise).rejects.toThrow(HttpError)
    await expect(promise).rejects.toSatisfy((error) => isHttpError(error))
  })
})

describe('httpError re-export', () => {
  // The token-auth flow drives fetch() itself and constructs HttpError
  // directly, passing the vocabulary explicitly — the pattern this
  // clause pins: a refresh-token echo inside a raw JSON refusal reads
  // redacted.
  it('redacts token-bearing JSON text when the vocabulary is seated', () => {
    const error = new HttpError('boom', {
      config: { method: 'POST', url: '/connect/token' },
      redaction,
      response: {
        data: '{"error":"invalid_grant","refresh_token":"tok-123"}',
        headers: {},
        status: 400,
      },
    })

    expect(error.response.data).toBe(
      '{"error":"invalid_grant","refresh_token":"******"}',
    )
  })
})

describe('httpStatus re-export', () => {
  it('carries the union table this SDK branches on', () => {
    expect(HttpStatus.NotFound).toBe(404)
    expect(HttpStatus.TooManyRequests).toBe(429)
    expect(HttpStatus.Unauthorized).toBe(401)
    // Additive arrival from the union with heatzy-api's vocabulary.
    expect(HttpStatus.BadRequest).toBe(400)
  })
})
