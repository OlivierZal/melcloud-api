import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HttpClient, HttpError, isHttpError } from '../../src/http/index.ts'
import { cast, mockFetchResponse } from '../helpers.ts'

type FetchInit = NonNullable<Parameters<typeof fetch>[1]>

const mockFetch = vi.fn<typeof fetch>()
vi.stubGlobal('fetch', mockFetch)

const extractInit = (): FetchInit => {
  const init = mockFetch.mock.calls[0]?.[1]
  if (init === undefined) {
    throw new TypeError('mockFetch was not called')
  }
  return init
}

const extractHeaders = (): Record<string, string> => cast(extractInit().headers)

const extractUrl = (): string => {
  const first = mockFetch.mock.calls[0]?.[0]
  if (typeof first !== 'string') {
    throw new TypeError('expected a string URL')
  }
  return first
}

describe('httpError', () => {
  it('carries response payload, headers, and status', () => {
    const error = new HttpError('boom', {
      config: { method: 'GET', url: '/where' },
      response: { data: { reason: 'x' }, headers: { 'x-y': 'z' }, status: 500 },
    })

    expect(error.message).toBe('boom')
    expect(error.response.status).toBe(500)
    expect(error.response.data).toStrictEqual({ reason: 'x' })
    expect(error.response.headers['x-y']).toBe('z')
    expect(error.config?.url).toBe('/where')
    expect(error.config?.method).toBe('GET')
    expect(error.isHttpError).toBe(true)
    expect(error.name).toBe('HttpError')
  })

  it('omits config when the caller did not pass one', () => {
    const error = new HttpError('boom', {
      response: { data: null, headers: {}, status: 500 },
    })

    expect(error.config).toBeUndefined()
  })

  // Security regression guard (user report, 2026-08-21): the request
  // snapshot rides inside the thrown error into every host logger and
  // into the diagnostic reports users paste into issues, and it used to
  // carry `Authorization: Bearer …` verbatim.
  it('redacts secret-bearing request headers and leaves the others verbatim', () => {
    const error = new HttpError('boom', {
      config: {
        headers: {
          Authorization: 'Bearer secret',
          'Content-Type': 'application/json',
          'X-MitsContextKey': 'ctx',
        },
      },
      response: { data: null, headers: {}, status: 401 },
    })

    expect(error.config?.headers).toStrictEqual({
      Authorization: '******',
      'Content-Type': 'application/json',
      'X-MitsContextKey': '******',
    })
  })

  it.each(['authorization', 'Authorization', 'AUTHORIZATION'])(
    'redacts %s regardless of casing',
    (key) => {
      const error = new HttpError('boom', {
        config: { headers: { [key]: 'Bearer secret' } },
        response: { data: null, headers: {}, status: 401 },
      })

      expect(error.config?.headers?.[key]).toBe('******')
    },
  )

  it('passes a config without headers through unchanged', () => {
    const config = {
      data: { id: 1 },
      method: 'POST',
      params: { verbose: true },
      url: '/where',
    }
    const error = new HttpError('boom', {
      config,
      response: { data: null, headers: {}, status: 500 },
    })

    expect(error.config).toStrictEqual(config)
    // No `headers` key conjured out of the absent one.
    expect(error.config?.headers).toBeUndefined()
  })

  // What came back is redacted by the same vocabulary: a session cookie
  // is a credential wherever it sits. Everything the retry policies read
  // — `retry-after` above all — must survive untouched.
  it('redacts the secrets the server sent back', () => {
    const error = new HttpError('boom', {
      config: { headers: { Authorization: 'Bearer secret' } },
      response: {
        data: null,
        headers: {
          authorization: 'Bearer echoed',
          'retry-after': '30',
          'set-cookie': ['session=1', 'flag=2'],
          'x-trace': 'abc',
        },
        status: 500,
      },
    })

    expect(error.config?.headers?.Authorization).toBe('******')
    expect(error.response.headers.authorization).toBe('******')
    expect(error.response.headers['set-cookie']).toBe('******')
    expect(error.response.headers['retry-after']).toBe('30')
    expect(error.response.headers['x-trace']).toBe('abc')
  })

  // The Classic sign-in carries the account's password in the BODY, and
  // a credential can ride a query string too: the snapshot redacts every
  // field, not just the obvious header.
  it('redacts the credentials in the body and the query', () => {
    const error = new HttpError('boom', {
      config: {
        data: {
          AppVersion: '1.38.4.0',
          Email: 'user@example.com',
          Password: 'hunter2',
          Persist: true,
        },
        method: 'post',
        params: { password: 'in-query', trace: 'keep' },
        url: '/Login/ClientLogin3',
      },
      response: { data: null, headers: {}, status: 500 },
    })

    expect(error.config?.data).toStrictEqual({
      AppVersion: '1.38.4.0',
      Email: '******',
      Password: '******',
      Persist: true,
    })
    expect(error.config?.params?.password).toBe('******')
    expect(error.config?.params?.trace).toBe('keep')
  })
})

describe(isHttpError, () => {
  it('narrows HttpError instances', () => {
    // Typed `unknown`, which is where the guard earns its keep: the
    // error arrives from a `catch`, not from a constructor call.
    const error: unknown = new HttpError('boom', {
      response: { data: null, headers: {}, status: 500 },
    })

    expect(isHttpError(error)).toBe(true)
  })

  it('rejects non-HttpError values', () => {
    expect(isHttpError(new Error('boom'))).toBe(false)
    expect(isHttpError('boom')).toBe(false)
    expect(isHttpError(null)).toBe(false)
    expect(isHttpError({})).toBe(false)
  })
})

describe(HttpClient, () => {
  const BASE_URL = 'https://api.test.local'

  beforeEach(() => {
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const createClient = (): HttpClient =>
    new HttpClient({ baseURL: BASE_URL, timeout: 0 })

  it('surfaces baseURL and timeout for diagnostic inspection', () => {
    const client = new HttpClient({ baseURL: BASE_URL, timeout: 5000 })

    expect(client.baseURL).toBe(BASE_URL)
    expect(client.timeout).toBe(5000)
  })

  it('returns { data, status, headers } from a JSON response', async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse({ ok: true }, { 'x-trace': 'abc' }, 200),
    )

    const response = await createClient().request<{ ok: boolean }>({
      url: '/echo',
    })

    expect(response.data).toStrictEqual({ ok: true })
    expect(response.status).toBe(200)
    expect(response.headers['x-trace']).toBe('abc')
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE_URL}/echo`,
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('serialises object bodies as JSON and sets Content-Type', async () => {
    mockFetch.mockResolvedValueOnce(mockFetchResponse({}, {}, 200))

    await createClient().request({
      data: { hello: 'world' },
      method: 'post',
      url: '/send',
    })

    const init = extractInit()

    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"hello":"world"}')
    expect(extractHeaders()['Content-Type']).toBe('application/json')
  })

  it('preserves a caller-supplied Content-Type on object bodies', async () => {
    mockFetch.mockResolvedValueOnce(mockFetchResponse({}, {}, 200))

    await createClient().request({
      data: { count: 1 },
      headers: { 'Content-Type': 'application/vnd.custom+json' },
      method: 'POST',
      url: '/s',
    })

    expect(extractHeaders()['Content-Type']).toBe('application/vnd.custom+json')
    expect(extractInit().body).toBe('{"count":1}')
  })

  it('passes string bodies through without setting Content-Type', async () => {
    mockFetch.mockResolvedValueOnce(mockFetchResponse({}, {}, 200))

    await createClient().request({
      data: 'raw=1&plain=2',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
      url: '/form',
    })

    expect(extractInit().body).toBe('raw=1&plain=2')
    expect(extractHeaders()['Content-Type']).toBe(
      'application/x-www-form-urlencoded',
    )
  })

  it('passes URLSearchParams bodies through unchanged', async () => {
    mockFetch.mockResolvedValueOnce(mockFetchResponse({}, {}, 200))
    const body = new URLSearchParams({ key: '1' })

    await createClient().request({ data: body, method: 'POST', url: '/form' })

    expect(extractInit().body).toBe(body)
  })

  it('defaults the error config method to GET when none was specified', async () => {
    mockFetch.mockResolvedValueOnce(mockFetchResponse({}, {}, 500))

    await expect(
      createClient().request({ url: '/boom' }),
    ).rejects.toMatchObject({ config: { method: 'GET' } })
  })

  it('throws HttpError on non-2xx with body, headers, status, and config', async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse({ err: 'denied' }, { 'retry-after': '3' }, 429),
    )

    const promise = createClient().request({
      data: { key: 1 },
      method: 'POST',
      url: '/x',
    })

    await expect(promise).rejects.toThrow(HttpError)
    await expect(promise).rejects.toMatchObject({
      config: { method: 'POST', url: '/x' },
      isHttpError: true,
      response: {
        data: { err: 'denied' },
        headers: { 'retry-after': '3' },
        status: 429,
      },
    })
  })

  // The end-to-end clause that would have caught the leak: the error a
  // real request throws must not carry the bearer token that request
  // just sent — default headers and per-request headers alike.
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

  it('returns text when the response is not JSON', async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse('plain text', { 'content-type': 'text/plain' }, 200),
    )

    const { data } = await createClient().request({ url: '/t' })

    expect(data).toBe('plain text')
  })

  it('returns "" on 204 No Content', async () => {
    mockFetch.mockResolvedValueOnce(mockFetchResponse('', {}, 204))

    const { data } = await createClient().request({ url: '/empty' })

    expect(data).toBe('')
  })

  it('returns "" when content-length is 0', async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse('', { 'content-length': '0' }, 200),
    )

    const { data } = await createClient().request({ url: '/zero' })

    expect(data).toBe('')
  })

  it('returns "" on an empty JSON body', async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse('', { 'content-type': 'application/json' }, 200),
    )

    const { data } = await createClient().request({ url: '/empty-json' })

    expect(data).toBe('')
  })

  it('appends query params from the config', async () => {
    mockFetch.mockResolvedValueOnce(mockFetchResponse({}, {}, 200))

    await createClient().request({
      params: { first: 1, second: 'x', skip: null, skip2: undefined },
      url: '/q',
    })

    const url = extractUrl()

    expect(url).toContain(`${BASE_URL}/q?`)
    expect(url).toContain('first=1')
    expect(url).toContain('second=x')
    expect(url).not.toContain('skip')
  })

  it('merges params with an existing query string', async () => {
    mockFetch.mockResolvedValueOnce(mockFetchResponse({}, {}, 200))

    await createClient().request({ params: { second: 2 }, url: '/q?first=1' })

    expect(extractUrl()).toBe(`${BASE_URL}/q?first=1&second=2`)
  })

  it('drops the query string when params resolve to empty', async () => {
    mockFetch.mockResolvedValueOnce(mockFetchResponse({}, {}, 200))

    await createClient().request({
      params: { skip: null, skip2: undefined },
      url: '/q',
    })

    expect(extractUrl()).toBe(`${BASE_URL}/q`)
  })

  it('uses the baseURL when url is omitted', async () => {
    mockFetch.mockResolvedValueOnce(mockFetchResponse({}, {}, 200))

    await createClient().request({})

    expect(extractUrl()).toBe(BASE_URL)
  })

  it('passes absolute URLs through unchanged', async () => {
    mockFetch.mockResolvedValueOnce(mockFetchResponse({}, {}, 200))

    await createClient().request({ url: 'https://other.example/path' })

    expect(extractUrl()).toBe('https://other.example/path')
  })

  it('normalises a non-absolute url missing its leading slash', async () => {
    const client = new HttpClient({ baseURL: `${BASE_URL}/`, timeout: 0 })
    mockFetch.mockResolvedValueOnce(mockFetchResponse({}, {}, 200))

    await client.request({ url: 'rel' })

    expect(extractUrl()).toBe(`${BASE_URL}/rel`)
  })

  it('preserves the base path when joining an absolute-style url', async () => {
    const client = new HttpClient({
      baseURL: `${BASE_URL}/Mitsubishi.Wifi.Client`,
      timeout: 0,
    })
    mockFetch.mockResolvedValueOnce(mockFetchResponse({}, {}, 200))

    await client.request({ url: '/User/ListDevices' })

    expect(extractUrl()).toBe(
      `${BASE_URL}/Mitsubishi.Wifi.Client/User/ListDevices`,
    )
  })

  it('parses a JSON body when content-type is missing', async () => {
    mockFetch.mockResolvedValueOnce(mockFetchResponse('{"ok":1}', {}, 200))

    const { data } = await createClient().request({ url: '/j' })

    expect(data).toStrictEqual({ ok: 1 })
  })

  it('parses a JSON body when content-type is a non-standard JSON variant', async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse({ ok: 1 }, { 'content-type': 'text/json' }, 200),
    )

    const { data } = await createClient().request({ url: '/j' })

    expect(data).toStrictEqual({ ok: 1 })
  })

  it('merges defaultHeaders with per-request headers', async () => {
    const client = new HttpClient({
      baseURL: BASE_URL,
      headers: { 'X-Default': 'd' },
      timeout: 0,
    })
    mockFetch.mockResolvedValueOnce(mockFetchResponse({}, {}, 200))

    await client.request({ headers: { 'X-Extra': 'e' }, url: '/h' })

    const headers = extractHeaders()

    expect(headers['X-Default']).toBe('d')
    expect(headers['X-Extra']).toBe('e')
  })

  it('passes the caller AbortSignal through', async () => {
    mockFetch.mockResolvedValueOnce(mockFetchResponse({}, {}, 200))
    const controller = new AbortController()

    await createClient().request({ signal: controller.signal, url: '/s' })

    expect(extractInit().signal).toBeDefined()
  })

  it('combines caller signal with a timeout when timeout > 0', async () => {
    vi.useFakeTimers()
    mockFetch.mockResolvedValueOnce(mockFetchResponse({}, {}, 200))
    const client = new HttpClient({ baseURL: BASE_URL, timeout: 5000 })
    const controller = new AbortController()

    await client.request({ signal: controller.signal, url: '/s' })

    expect(extractInit().signal).toBeDefined()
  })

  it('does not forward a signal when neither caller nor timeout set', async () => {
    mockFetch.mockResolvedValueOnce(mockFetchResponse({}, {}, 200))

    await createClient().request({ url: '/noabort' })

    expect(extractInit().signal).toBeUndefined()
  })

  it('forwards the configured dispatcher into fetch', async () => {
    // Sentinel object — runtime shape is the only thing fetch inspects.
    const dispatcher = { sentinel: true }
    const client = new HttpClient({ baseURL: BASE_URL, dispatcher, timeout: 0 })
    mockFetch.mockResolvedValueOnce(mockFetchResponse({}, {}, 200))

    await client.request({ url: '/d' })

    const init: { dispatcher?: unknown } = cast(extractInit())

    expect(init.dispatcher).toBe(dispatcher)
  })

  it('surfaces Set-Cookie arrays via getSetCookie()', async () => {
    const headers = new Headers()
    headers.append('set-cookie', 'a=1')
    headers.append('set-cookie', 'b=2')
    mockFetch.mockResolvedValueOnce(Response.json({}, { headers, status: 200 }))

    const { headers: responseHeaders } = await createClient().request({
      url: '/c',
    })

    expect(responseHeaders['set-cookie']).toStrictEqual(['a=1', 'b=2'])
  })
})
