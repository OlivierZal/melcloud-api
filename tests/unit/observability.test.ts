import { describe, expect, it } from 'vitest'

import { HttpError } from '../../src/http/index.ts'
import {
  APICallRequestData,
  APICallResponseData,
  createAPICallErrorData,
} from '../../src/observability/index.ts'
import { cast } from '../helpers.ts'

interface TestRequestConfig {
  data?: unknown
  headers?: Record<string, string>
  method?: string
  params?: Record<string, unknown>
  url?: string
}

interface TestResponse {
  data: unknown
  headers: Record<string, string | string[]>
  status: number
}

const createConfig = (
  overrides: Partial<TestRequestConfig> = {},
): TestRequestConfig => ({
  data: { key: 'value' },
  headers: { 'Content-Type': 'application/json' },
  method: 'post',
  params: { id: 1 },
  url: '/test/endpoint',
  ...overrides,
})

const createResponse = (
  overrides: Partial<TestResponse> = {},
): TestResponse => ({
  data: { result: 'ok' },
  headers: { 'x-custom': 'header' },
  status: 200,
  ...overrides,
})

describe('api call request data', () => {
  it('extracts request fields from config', () => {
    const data = new APICallRequestData(createConfig())

    expect(data.dataType).toBe('API request')
    expect(data.method).toBe('POST')
    expect(data.url).toBe('/test/endpoint')
    expect(data.params).toStrictEqual({ id: 1 })
    expect(data.requestData).toStrictEqual({ key: 'value' })
    expect(data.headers).toStrictEqual({ 'Content-Type': 'application/json' })
  })

  it('handles undefined config', () => {
    const data = new APICallRequestData()

    expect(data.method).toBeUndefined()
    expect(data.url).toBeUndefined()
    expect(data.params).toBeUndefined()
    expect(data.requestData).toBeUndefined()
    expect(data.headers).toBeUndefined()
  })

  it('serializes to JSON with logKeys', () => {
    const data = new APICallRequestData(createConfig())
    const parsed: Record<string, unknown> = cast(JSON.parse(data.toString()))

    expect(parsed.dataType).toBe('API request')
    expect(parsed.method).toBe('POST')
    expect(parsed.url).toBe('/test/endpoint')
    expect(parsed).toHaveProperty('headers')
    expect(parsed).toHaveProperty('params')
    expect(parsed).toHaveProperty('requestData')
  })
})

describe('api call response data', () => {
  it('extracts response fields', () => {
    const data = new APICallResponseData(createResponse(), createConfig())

    expect(data.dataType).toBe('API response')
    expect(data.method).toBe('POST')
    expect(data.url).toBe('/test/endpoint')
    expect(data.status).toBe(200)
    expect(data.responseData).toStrictEqual({ result: 'ok' })
    expect(data.requestData).toStrictEqual({ key: 'value' })
  })

  it('handles undefined response', () => {
    const data = new APICallResponseData()

    expect(data.method).toBeUndefined()
    expect(data.url).toBeUndefined()
    expect(data.status).toBeUndefined()
    expect(data.responseData).toBeUndefined()
    expect(data.requestData).toBeUndefined()
  })

  it('handles response without config (partial HttpError shape)', () => {
    // An HttpError captured before the request fully materialized may carry
    // a response without a matching config. The logger must not throw —
    // turning a recoverable failure into a silent crash would be a much
    // worse outcome than missing requestData on the log line.
    const partial: TestResponse = {
      data: { error: 'oops' },
      headers: {},
      status: 503,
    }
    const data = new APICallResponseData(partial)

    expect(data.status).toBe(503)
    expect(data.responseData).toStrictEqual({ error: 'oops' })
    expect(data.requestData).toBeUndefined()
  })

  it('serializes to JSON with logKeys', () => {
    const data = new APICallResponseData(createResponse(), createConfig())
    const parsed: Record<string, unknown> = cast(JSON.parse(data.toString()))

    expect(parsed.dataType).toBe('API response')
    expect(parsed.method).toBe('POST')
    expect(parsed.url).toBe('/test/endpoint')
    expect(parsed.status).toBe(200)
    expect(parsed).toHaveProperty('requestData')
    expect(parsed).toHaveProperty('responseData')
  })
})

const parseLog = (
  value: string,
): {
  headers: Record<string, unknown>
  requestData: Record<string, unknown>
} => cast(JSON.parse(value))

describe('sensitive data redaction', () => {
  it('redacts credentials in request data', () => {
    const config = createConfig({
      data: { Email: 'user@example.com', Other: 'visible', Password: 's3cret' },
    })
    const { requestData } = parseLog(new APICallRequestData(config).toString())

    expect(requestData.Email).toBe('******')
    expect(requestData.Password).toBe('******')
    expect(requestData.Other).toBe('visible')
  })

  it('redacts auth headers in request data', () => {
    const config = createConfig({
      headers: {
        'Content-Type': 'application/json',
        'X-MitsContextKey': 'abc123',
      },
    })
    const { headers } = parseLog(new APICallRequestData(config).toString())

    expect(headers['X-MitsContextKey']).toBe('******')
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('redacts cookie headers in response data', () => {
    const response = createResponse({
      headers: { 'set-cookie': ['session=abc123'], 'x-custom': 'visible' },
    })
    const { headers } = parseLog(new APICallResponseData(response).toString())

    expect(headers['set-cookie']).toBe('******')
    expect(headers['x-custom']).toBe('visible')
  })

  it('redacts username and password in form data', () => {
    const config = createConfig({
      data: { password: 'p@ss', username: 'admin' },
    })
    const { requestData } = parseLog(new APICallRequestData(config).toString())

    expect(requestData.password).toBe('******')
    expect(requestData.username).toBe('******')
  })

  it('redacts Cookie header in request data', () => {
    const config = createConfig({
      headers: { Cookie: 'session=xyz' },
    })
    const { headers } = parseLog(new APICallRequestData(config).toString())

    expect(headers.Cookie).toBe('******')
  })

  it('redacts sensitive keys inside form-encoded string bodies', () => {
    // Home's `#submitCredentials()` posts credentials as a form-encoded
    // string (URLSearchParams.toString()). Without explicit string
    // handling in `redactValue()`, the entire body — including
    // `password=...` and `username=...` — would leak verbatim into the
    // request log lines.
    const config = createConfig({
      data: 'csrf=tok&password=s3cret&username=user%40example.com&extra=visible',
    })
    const parsed: { requestData: string } = cast(
      JSON.parse(new APICallRequestData(config).toString()),
    )
    const params = new URLSearchParams(parsed.requestData)

    expect(params.get('password')).toBe('******')
    expect(params.get('username')).toBe('******')
    expect(params.get('csrf')).toBe('tok')
    expect(params.get('extra')).toBe('visible')
  })

  it('passes through non-sensitive form-encoded strings unchanged', () => {
    const config = createConfig({ data: 'page=2&limit=50' })
    const parsed: { requestData: string } = cast(
      JSON.parse(new APICallRequestData(config).toString()),
    )

    expect(parsed.requestData).toBe('page=2&limit=50')
  })

  it('does not mutate plain strings that happen to lack `=`', () => {
    const config = createConfig({ data: 'just a sentence' })
    const parsed: { requestData: string } = cast(
      JSON.parse(new APICallRequestData(config).toString()),
    )

    expect(parsed.requestData).toBe('just a sentence')
  })
})

describe(createAPICallErrorData, () => {
  it('creates error data from response error', () => {
    const error = new HttpError(
      'Request failed',
      { data: {}, headers: {}, status: 500 },
      createConfig(),
    )
    const data = createAPICallErrorData(error)

    expect(data.errorMessage).toBe('Request failed')
    expect(data.dataType).toBe('API response')
  })

  it('creates error data from request error (no HTTP response)', () => {
    const error = new Error('Network Error')
    const data = createAPICallErrorData(error)

    expect(data.errorMessage).toBe('Network Error')
    expect(data.dataType).toBe('API request')
  })

  it('serializes error data with errorMessage included', () => {
    const error = new HttpError(
      'Timeout',
      { data: {}, headers: {}, status: 504 },
      createConfig(),
    )
    const data = createAPICallErrorData(error)
    const parsed: Record<string, unknown> = cast(JSON.parse(data.toString()))

    expect(parsed.errorMessage).toBe('Timeout')
  })
})
