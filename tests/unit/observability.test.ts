import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { HttpError } from '../../src/http/index.ts'
import {
  isSensitive,
  REDACTED,
  redactUrl,
  redactValue,
} from '../../src/observability/context.ts'
import {
  APICallRequestData,
  APICallResponseData,
  createAPICallErrorData,
} from '../../src/observability/index.ts'
import { defined } from '../helpers.ts'

// Thin VOCABULARY suite: the redaction and log-shell MECHANISMS (and
// their mutation-checked suites) live in @olivierzal/api-core. What
// this file pins is the MELCloud layer's own obligation — its
// sensitive-key vocabulary, and the fact that every shell this SDK
// exports arrives pre-bound to it, with no call site passing anything.

const jsonRecord = z.record(z.string(), z.unknown())

const logShape = z.object({
  headers: jsonRecord.optional(),
  requestData: jsonRecord.optional(),
})

const parseLog = (value: string): z.infer<typeof logShape> => {
  const raw: unknown = JSON.parse(value)
  return logShape.parse(raw)
}

describe.concurrent('the MELCloud vocabulary', () => {
  it.each([
    'access_token',
    'client_secret',
    'code',
    'code_verifier',
    'contextkey',
    'id_token',
    'owneremail',
    'refresh_token',
    'x-mitscontextkey',
  ])('marks the protocol key %s sensitive in any casing', (key) => {
    expect(isSensitive(key)).toBe(true)
    expect(isSensitive(key.toUpperCase())).toBe(true)
  })

  it.each(['authorization', 'cookie', 'password', 'token', 'username'])(
    'keeps the core base key %s sensitive',
    (key) => {
      expect(isSensitive(key)).toBe(true)
    },
  )

  it('leaves non-credential keys alone', () => {
    expect(isSensitive('retry-after')).toBe(false)
    expect(isSensitive('x-trace')).toBe(false)
  })

  it('deep-redacts protocol keys through the bound engine', () => {
    expect(
      redactValue({ nested: { ContextKey: 'ctx', safe: 'ok' } }),
    ).toStrictEqual({ nested: { ContextKey: REDACTED, safe: 'ok' } })
  })

  it('redacts the OAuth code riding a URL query', () => {
    expect(redactUrl('/callback?code=auth-code&state=xyz')).toBe(
      `/callback?code=${REDACTED}&state=xyz`,
    )
  })
})

describe.concurrent('the shells arrive pre-bound', () => {
  it('aPICallRequestData redacts a protocol header with no engine passed', () => {
    const call = new APICallRequestData({
      headers: {
        'Content-Type': 'application/json',
        'X-MitsContextKey': 'abc123',
      },
      method: 'post',
      url: '/x',
    })
    const headers = defined(parseLog(call.toString()).headers)

    expect(headers['X-MitsContextKey']).toBe(REDACTED)
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('aPICallResponseData redacts the account address the list echoes', () => {
    const call = new APICallResponseData({
      data: { Structure: { OwnerEmail: 'user@example.com', Zone: 'kept' } },
      headers: {},
      status: 200,
    })
    const raw: unknown = JSON.parse(call.toString())
    const { responseData } = z.object({ responseData: jsonRecord }).parse(raw)

    expect(responseData.Structure).toStrictEqual({
      OwnerEmail: REDACTED,
      Zone: 'kept',
    })
  })

  it('createAPICallErrorData redacts through the same vocabulary', () => {
    // The error below is built WITHOUT the MELCloud engine (only the
    // core base applies at construction), so the context key survives
    // into the snapshot — the serialization pass through this SDK's
    // bound factory must still blank it. Both locks carry the same
    // vocabulary; this clause pins the second one.
    const error = new HttpError('boom', {
      config: { url: '/x' },
      response: {
        data: null,
        headers: { 'x-mitscontextkey': 'ctx', 'x-trace': 'keep' },
        status: 500,
      },
    })
    const data = createAPICallErrorData(error)
    const headers = defined(parseLog(data.toString()).headers)

    expect(data.errorMessage).toBe('boom')
    expect(data.dataType).toBe('API response')
    expect(headers['x-mitscontextkey']).toBe(REDACTED)
    expect(headers['x-trace']).toBe('keep')
  })

  it('createAPICallErrorData falls back to request data on a plain Error', () => {
    const data = createAPICallErrorData(new Error('Network Error'))

    expect(data.errorMessage).toBe('Network Error')
    expect(data.dataType).toBe('API request')
  })
})
